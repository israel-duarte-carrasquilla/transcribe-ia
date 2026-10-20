import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';
import { MeetingData } from '../types/meeting';

/**
 * Downloads a Blob as a file with the specified filename
 */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clean file name helper
 */
function sanitizeFileName(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);
}

/**
 * Export Meeting to PDF using jsPDF
 */
export async function exportToPDF(meeting: MeetingData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function checkPageBreak(requiredSpace: number) {
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // Header banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(margin, y, contentWidth, 18, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TranscribeIA • Acta y Resumen Ejecutivo de Reunión', margin + 6, y + 11);
  y += 24;

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(meeting.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 4;

  // Metadata Row
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const metaText = `Fecha: ${meeting.date}   |   Duración: ${meeting.estimatedDuration}   |   Idioma: ${meeting.language}   |   Participantes: ${meeting.participants.length}`;
  doc.text(metaText, margin, y);
  y += 8;

  // Horizontal divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentWidth, y);
  y += 8;

  // 1. Participantes
  checkPageBreak(25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Participantes Identificados', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  meeting.participants.forEach((p) => {
    checkPageBreak(8);
    const perc = p.speakingPercentage ? ` (${p.speakingPercentage}% intervención)` : '';
    doc.text(`• ${p.name} - ${p.role}${perc}`, margin + 4, y);
    y += 5.5;
  });
  y += 4;

  // 2. Resumen Ejecutivo
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Resumen Ejecutivo', margin, y);
  y += 6;

  // Objetivo
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Objetivo de la Reunión:', margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const objLines = doc.splitTextToSize(meeting.executiveSummary.objective, contentWidth - 4);
  doc.text(objLines, margin + 2, y);
  y += objLines.length * 5 + 4;

  // Puntos clave
  checkPageBreak(20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Puntos Clave Discutidos:', margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  meeting.executiveSummary.keyPoints.forEach((point) => {
    checkPageBreak(12);
    const pLines = doc.splitTextToSize(`• ${point}`, contentWidth - 6);
    doc.text(pLines, margin + 4, y);
    y += pLines.length * 4.8;
  });
  y += 4;

  // Decisiones y Acuerdos
  checkPageBreak(20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61); // Green
  doc.text('Decisiones y Acuerdos Adoptados:', margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  meeting.executiveSummary.decisions.forEach((decision) => {
    checkPageBreak(12);
    const dLines = doc.splitTextToSize(`✓ ${decision}`, contentWidth - 6);
    doc.text(dLines, margin + 4, y);
    y += dLines.length * 4.8;
  });
  y += 6;

  // 3. Tareas Pendientes y Compromisos
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('3. Plan de Acción y Tareas Pendientes', margin, y);
  y += 6;

  meeting.actionItems.forEach((item, index) => {
    checkPageBreak(16);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const taskHeader = `[${item.priority}] ${item.task}`;
    const taskHeaderLines = doc.splitTextToSize(taskHeader, contentWidth - 10);
    doc.text(taskHeaderLines, margin + 4, y + 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Responsable: ${item.assignee}   |   Plazo: ${item.deadline}   |   Estado: ${item.status}`, margin + 4, y + 10.5);

    y += 16;
  });
  y += 4;

  // 4. Transcripción Diarizada Completa
  checkPageBreak(25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('4. Transcripción Completa Diarizada', margin, y);
  y += 6;

  meeting.transcript.forEach((segment) => {
    const headerStr = `[${segment.timestamp}] ${segment.speakerName}:`;
    const textLines = doc.splitTextToSize(segment.text, contentWidth - 8);
    const segmentHeight = 5 + textLines.length * 4.5 + 4;

    checkPageBreak(segmentHeight);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138); // Blue
    doc.text(headerStr, margin + 2, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(textLines, margin + 4, y);
    y += textLines.length * 4.5 + 3;
  });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages} • Generado con TranscribeIA`, pageWidth / 2, pageHeight - 8, {
      align: 'center',
    });
  }

  const fileName = `TranscribeIA_${sanitizeFileName(meeting.title)}.pdf`;
  doc.save(fileName);
}

/**
 * Export Meeting to Microsoft Word (.docx) using docx library
 */
export async function exportToWord(meeting: MeetingData) {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.NONE },
  };

  const actionItemRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 4500, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Tarea / Compromiso', bold: true, color: '1E293B' })] })],
        }),
        new TableCell({
          width: { size: 2200, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Responsable', bold: true, color: '1E293B' })] })],
        }),
        new TableCell({
          width: { size: 1500, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Prioridad', bold: true, color: '1E293B' })] })],
        }),
        new TableCell({
          width: { size: 1800, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Plazo Límite', bold: true, color: '1E293B' })] })],
        }),
      ],
    }),
  ];

  meeting.actionItems.forEach((item) => {
    actionItemRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: item.task })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: item.assignee, bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: item.priority })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: item.deadline })] })],
          }),
        ],
      })
    );
  });

  const transcriptParagraphs: Paragraph[] = [];
  meeting.transcript.forEach((s) => {
    transcriptParagraphs.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({
            text: `[${s.timestamp}] ${s.speakerName}`,
            bold: true,
            color: '2563EB',
          }),
          new TextRun({ text: s.topic ? ` (${s.topic})` : '', italics: true, color: '64748B' }),
        ],
      })
    );
    transcriptParagraphs.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: s.text, color: '334155' })],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: meeting.title,
            heading: HeadingLevel.TITLE,
            spacing: { after: 120 },
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: `Fecha: ${meeting.date}  |  Duración: ${meeting.estimatedDuration}  |  Idioma: ${meeting.language}`,
                color: '64748B',
                size: 20,
              }),
            ],
          }),

          // Participantes
          new Paragraph({
            text: '1. Participantes Identificados',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          }),
          ...meeting.participants.map(
            (p) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: `${p.name} - `, bold: true }),
                  new TextRun({ text: `${p.role} ${p.speakingPercentage ? `(${p.speakingPercentage}% tiempo)` : ''}` }),
                ],
              })
          ),

          // Resumen
          new Paragraph({
            text: '2. Resumen Ejecutivo',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Objetivo: ', bold: true }),
              new TextRun({ text: meeting.executiveSummary.objective }),
            ],
            spacing: { after: 160 },
          }),
          new Paragraph({
            text: 'Puntos Clave:',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 80 },
          }),
          ...meeting.executiveSummary.keyPoints.map(
            (pt) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: pt })],
              })
          ),
          new Paragraph({
            text: 'Decisiones y Acuerdos:',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 80 },
          }),
          ...meeting.executiveSummary.decisions.map(
            (dec) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: dec, bold: true, color: '15803D' })],
              })
          ),

          // Tareas
          new Paragraph({
            text: '3. Plan de Acción y Tareas Pendientes',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 160 },
          }),
          new Table({
            rows: actionItemRows,
            borders: tableBorder,
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Transcripcion
          new Paragraph({
            text: '4. Transcripción Completa Diarizada',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 160 },
          }),
          ...transcriptParagraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `TranscribeIA_${sanitizeFileName(meeting.title)}.docx`;
  downloadBlob(blob, fileName);
}

/**
 * Export Meeting to SubRip Subtitles (.srt)
 */
export function exportToSRT(meeting: MeetingData) {
  let srtContent = '';

  meeting.transcript.forEach((segment, index) => {
    const seq = index + 1;
    const startSec = segment.seconds || 0;
    const nextSegment = meeting.transcript[index + 1];
    const duration = nextSegment ? Math.max(3, nextSegment.seconds - startSec) : 5;
    const endSec = startSec + duration;

    function formatSrtTime(totalSec: number): string {
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = Math.floor(totalSec % 60);
      const ms = 0;
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    const timeLine = `${formatSrtTime(startSec)} --> ${formatSrtTime(endSec)}`;
    const textLine = `[${segment.speakerName}]: ${segment.text}`;

    srtContent += `${seq}\n${timeLine}\n${textLine}\n\n`;
  });

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const fileName = `TranscribeIA_${sanitizeFileName(meeting.title)}.srt`;
  downloadBlob(blob, fileName);
}

/**
 * Export Meeting to Plain Text (.txt)
 */
export function exportToTXT(meeting: MeetingData) {
  let content = `========================================================================\n`;
  content += `TRANSCRIBEIA - ACTA Y RESUMEN EJECUTIVO DE REUNIÓN\n`;
  content += `========================================================================\n\n`;
  content += `Título:       ${meeting.title}\n`;
  content += `Fecha:        ${meeting.date}\n`;
  content += `Duración:     ${meeting.estimatedDuration}\n`;
  content += `Idioma:       ${meeting.language}\n`;
  content += `Participantes:\n`;
  meeting.participants.forEach((p) => {
    content += `  - ${p.name} (${p.role}) [${p.speakingPercentage || 0}% de habla]\n`;
  });
  content += `\n`;

  content += `------------------------------------------------------------------------\n`;
  content += `1. RESUMEN EJECUTIVO\n`;
  content += `------------------------------------------------------------------------\n`;
  content += `OBJETIVO:\n${meeting.executiveSummary.objective}\n\n`;
  content += `PUNTOS CLAVE:\n`;
  meeting.executiveSummary.keyPoints.forEach((pt) => {
    content += `  • ${pt}\n`;
  });
  content += `\nDECISIONES Y ACUERDOS:\n`;
  meeting.executiveSummary.decisions.forEach((dec) => {
    content += `  ✓ ${dec}\n`;
  });
  content += `\n`;

  content += `------------------------------------------------------------------------\n`;
  content += `2. PLAN DE ACCIÓN Y TAREAS PENDIENTES\n`;
  content += `------------------------------------------------------------------------\n`;
  meeting.actionItems.forEach((item, i) => {
    content += `[${i + 1}] ${item.task}\n`;
    content += `    Responsable: ${item.assignee} | Prioridad: ${item.priority} | Plazo: ${item.deadline} | Estado: ${item.status}\n\n`;
  });

  content += `------------------------------------------------------------------------\n`;
  content += `3. TRANSCRIPCIÓN COMPLETA CON DIARIZACIÓN\n`;
  content += `------------------------------------------------------------------------\n`;
  meeting.transcript.forEach((s) => {
    content += `[${s.timestamp}] ${s.speakerName}:\n${s.text}\n\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const fileName = `TranscribeIA_${sanitizeFileName(meeting.title)}.txt`;
  downloadBlob(blob, fileName);
}

/**
 * Export Meeting to CSV (.csv) for Excel and Sheets
 */
export function exportToCSV(meeting: MeetingData) {
  // UTF-8 BOM so Excel opens accents properly
  let csvContent = '\uFEFF';
  csvContent += `"Marca de Tiempo","Segundos","Participante","Rol","Tema","Transcripción"\n`;

  meeting.transcript.forEach((s) => {
    const cleanSpeaker = (s.speakerName || '').replace(/"/g, '""');
    const cleanText = (s.text || '').replace(/"/g, '""');
    const cleanTopic = (s.topic || '').replace(/"/g, '""');
    const participant = meeting.participants.find((p) => p.id === s.speakerId);
    const cleanRole = (participant?.role || '').replace(/"/g, '""');

    csvContent += `"${s.timestamp}","${s.seconds}","${cleanSpeaker}","${cleanRole}","${cleanTopic}","${cleanText}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `TranscribeIA_${sanitizeFileName(meeting.title)}_transcripcion.csv`;
  downloadBlob(blob, fileName);
}

/**
 * Export Tasks to CSV
 */
export function exportTasksToCSV(meeting: MeetingData) {
  let csvContent = '\uFEFF';
  csvContent += `"ID","Tarea","Responsable","Prioridad","Plazo","Estado"\n`;

  meeting.actionItems.forEach((item) => {
    const cleanTask = item.task.replace(/"/g, '""');
    const cleanAssignee = item.assignee.replace(/"/g, '""');
    const cleanDeadline = item.deadline.replace(/"/g, '""');
    csvContent += `"${item.id}","${cleanTask}","${cleanAssignee}","${item.priority}","${cleanDeadline}","${item.status}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `TranscribeIA_${sanitizeFileName(meeting.title)}_tareas.csv`;
  downloadBlob(blob, fileName);
}
