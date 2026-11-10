import ExcelJS from 'exceljs';
import { CourseMetadata, CutComparisonResult, ProcessedStudent, TutorialState } from '../types';
import { getStudentPersonalizedMessage } from './messages';

/**
 * Maps tutorial state and resolution to ExcelJS fill and font styling for the "Estado" cell.
 */
function getStateCellStyle(state: TutorialState, resolution?: string): {
  fill: ExcelJS.Fill;
  font: Partial<ExcelJS.Font>;
} {
  switch (state) {
    case 'ROJO':
      return {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8D7DA' }, // Soft Red
        },
        font: {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF842029' },
        },
      };
    case 'AMARILLO':
      return {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3CD' }, // Soft Yellow
        },
        font: {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF664D03' },
        },
      };
    case 'NARANJA':
      return {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE5D0' }, // Soft Orange
        },
        font: {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF853A00' },
        },
      };
    case 'VERDE':
      return {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1E7DD' }, // Soft Green
        },
        font: {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF0F5132' },
        },
      };
    case 'AZUL':
      return {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCFE2FF' }, // Soft Blue
        },
        font: {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF084298' },
        },
      };
    case 'NEGRO':
      if (resolution === 'N.A' || resolution === 'Reprobó') {
        return {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF7E22CE' }, // Morado (Purple 700)
          },
          font: {
            name: 'Calibri',
            size: 10,
            bold: true,
            color: { argb: 'FFFFFFFF' }, // White text
          },
        };
      }
      return {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF000000' }, // Pure Black
        },
        font: {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' }, // White text
        },
      };
    case 'INICIADO_PRIMER_CORTE':
    default:
      return {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' }, // Slate
        },
        font: {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF1E293B' },
        },
      };
  }
}

/**
 * Exports processed student tutorial data to a beautifully formatted Excel file using ExcelJS.
 */
export async function exportTutorialExcel(
  comparison: CutComparisonResult,
  courseMetadata: CourseMetadata
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Seguimiento Tutorial';
  workbook.created = new Date();

  const sheetName = `Corte_${comparison.currentSheetName}`;
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  const isTutorizado = comparison.courseType === 'TUTORIZADO' || courseMetadata.courseType === 'TUTORIZADO';

  // Defined columns with Insignia, Completed Units, and Tasks tracking
  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'Nombre', key: 'nombre', width: 22 },
    { header: 'Apellido(s)', key: 'apellidos', width: 24 },
    { header: 'Insignia', key: 'insignia', width: 14 },
    { header: 'Usuario', key: 'usuario', width: 18 },
    { header: 'Ciudad', key: 'ciudad', width: 18 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Dirección Email', key: 'email', width: 28 },
    { header: 'U. previa', key: 'uPrevia', width: 16 },
    { header: 'U. terminada', key: 'uTerminada', width: 16 },
  ];

  if (isTutorizado) {
    columns.push(
      { header: 'Tareas aprobadas', key: 'tareasAprobadas', width: 18 },
      { header: 'Tareas pendientes', key: 'tareasPendientes', width: 18 }
    );
  }

  columns.push(
    { header: 'Estado', key: 'estado', width: 24 },
    { header: 'Resolución tutorial', key: 'resolucionTutorial', width: 26 },
    { header: 'Cambio detectado', key: 'cambioDetectado', width: 32 },
    { header: 'Intervención recomendada', key: 'intervencion', width: 34 },
    { header: 'Mensaje personalizado', key: 'mensaje', width: 55 }
  );

  ws.columns = columns;

  // Format Header Row (Row 1)
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F294A' }, // Navy Blue
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0B1D33' } },
      bottom: { style: 'medium', color: { argb: 'FF0B1D33' } },
      left: { style: 'thin', color: { argb: 'FF2A4365' } },
      right: { style: 'thin', color: { argb: 'FF2A4365' } },
    };
  });

  // Dynamically find the column index for "Estado" by matching the header text
  let estadoColNumber = -1;
  headerRow.eachCell((cell, colNumber) => {
    const headerText = cell.value ? String(cell.value).trim().toLowerCase() : '';
    if (headerText === 'estado') {
      estadoColNumber = colNumber;
    }
  });

  // Fallback to searching ws.columns if needed
  if (estadoColNumber === -1) {
    const cols = ws.columns || [];
    const foundIdx = cols.findIndex(
      (c) =>
        (typeof c.header === 'string' && c.header.trim().toLowerCase() === 'estado') ||
        c.key === 'estado'
    );
    estadoColNumber = foundIdx >= 0 ? foundIdx + 1 : 10;
  }

  // Add Data Rows
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  comparison.students.forEach((s: ProcessedStudent) => {
    const isNA =
      s.state === 'NEGRO' &&
      (s.tutorialResolution === 'N.A' || s.tutorialResolution === 'Reprobó');
    const isSegundoIntento =
      s.state === 'NEGRO' &&
      s.tutorialResolution === 'Segundo intento otorgado';

    let estadoLabel = s.stateLabel;
    if (s.state === 'NEGRO') {
      if (isNA) {
        estadoLabel = 'REV. CALIF. · N.A';
      } else if (isSegundoIntento) {
        estadoLabel = 'REV. CALIF. · 2.º INTENTO';
      } else {
        estadoLabel = 'REV. CALIF.';
      }
    }

    let resolucionLabel = '-';
    if (s.state === 'NEGRO') {
      if (isNA) {
        resolucionLabel = 'N.A';
      } else if (isSegundoIntento) {
        resolucionLabel = 'Segundo intento otorgado';
      } else {
        resolucionLabel = 'Pendiente de revisión';
      }
    } else if (s.tutorialResolution) {
      resolucionLabel =
        s.tutorialResolution === 'Reprobó' || s.tutorialResolution === 'N.A'
          ? 'N.A'
          : s.tutorialResolution;
    }

    const prevU = s.previousCompletedUnitKey || (s.previousCompletedUnit > 0 ? `U${s.previousCompletedUnit}` : '-');
    const currU = s.currentCompletedUnitKey || (s.currentCompletedUnit > 0 ? `U${s.currentCompletedUnit}` : '-');

    const rowData: Record<string, string | number> = {
      nombre: s.nombre,
      apellidos: s.apellidos,
      insignia: s.insignia === 'MUJER' ? 'MUJER' : s.insignia === 'HOMBRE' ? 'HOMBRE' : 'REVISIÓN',
      usuario: s.usuario,
      ciudad: s.ciudad,
      departamento: s.departamento,
      email: s.email,
      uPrevia: prevU,
      uTerminada: currU,
      estado: estadoLabel,
      resolucionTutorial: resolucionLabel,
      cambioDetectado: s.changeDetected,
      intervencion: s.recommendedIntervention,
      mensaje: getStudentPersonalizedMessage(s),
    };

    if (isTutorizado && s.tasksSummary) {
      rowData.tareasAprobadas = `${s.tasksSummary.approvedTasks} / ${s.tasksSummary.totalTasks}`;
      rowData.tareasPendientes = s.tasksSummary.pendingTasks;
    }

    const row = ws.addRow(rowData);
    row.height = 24;

    // Apply border and general formatting to all cells in the row
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        wrapText: colNumber >= (isTutorizado ? 14 : 12),
        horizontal: colNumber === 3 || colNumber === 8 || colNumber === 9 ? 'center' : 'left',
      };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
    });

    // Columna NOMBRE (col 1): conserva fondo blanco, texto oscuro (ya aplicado por row.eachCell)
    // Aplicar color de estado EXCLUSIVAMENTE a la celda de la columna ESTADO (identificada dinámicamente)
    if (estadoColNumber > 0) {
      const estadoCell = row.getCell(estadoColNumber);
      const style = getStateCellStyle(s.state, s.tutorialResolution);
      estadoCell.fill = style.fill;
      estadoCell.font = style.font;
      estadoCell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false,
      };
    }
  });

  // Enable Autofilter across all columns
  const totalColumns = ws.columns ? ws.columns.length : 14;
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: comparison.students.length + 1, column: totalColumns },
  };

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const sanitizedCourseName = courseMetadata.name
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .substring(0, 30);
  const fileName = `Seguimiento_${sanitizedCourseName}_${comparison.currentSheetName}.xlsx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
