import { ProcessedStudent, StudentEvaluationIssue, TutorialState } from '../types';
import { formatAcademicUnitIdentifier } from './excelParser';

export interface InterventionInfo {
  title: string;
  state: TutorialState;
  colorName: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  accentBg: string;
  objective: string;
  baseMessage: string;
  emoji: string;
}

export const INTERVENTIONS: Record<TutorialState, InterventionInfo> = {
  ROJO: {
    title: 'SIN INICIO',
    state: 'ROJO',
    colorName: 'Rojo',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
    badgeText: 'text-rose-800',
    borderColor: 'border-rose-300',
    accentBg: 'bg-rose-50/70',
    objective: 'Invitar a iniciar el curso.',
    baseMessage: `¡Muy buen día, [NOMBRE]! 👋

Le envío este cordial recordatorio, ya que hasta el momento no se ha registrado actividad en el curso.

Aún se encuentra a tiempo de comenzar con la revisión de los contenidos y la realización de sus actividades.

Si ha tenido algún inconveniente técnico o personal que le impida acceder, por favor hágamelo saber para orientarle y brindarle el apoyo necesario.

Quedo a su disposición si requiere orientación.

¡Mucho éxito!`,
    emoji: '🔴',
  },
  AMARILLO: {
    title: 'PAUSA',
    state: 'AMARILLO',
    colorName: 'Amarillo',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    badgeText: 'text-amber-900',
    borderColor: 'border-amber-300',
    accentBg: 'bg-amber-50/70',
    objective: 'Motivar la continuidad y conclusión de actividades pendientes.',
    baseMessage: `¡Muy buen día, [NOMBRE]! 👋

Observo que ha comenzado, e incluso continuado, con algunas actividades del curso, aunque todavía tiene pendientes por completar.

Le sugiero organizar sus tiempos para que pueda continuar lo antes posible y aprovechar al máximo el contenido del curso.

Si tiene dudas sobre las actividades o necesita orientación sobre la plataforma, quedo a sus órdenes para apoyarle.

¡Mucho éxito!`,
    emoji: '🟡',
  },
  NARANJA: {
    title: 'SIN AVANCE',
    state: 'NARANJA',
    colorName: 'Naranja',
    badgeBg: 'bg-orange-100 text-orange-900 border-orange-300',
    badgeText: 'text-orange-900',
    borderColor: 'border-orange-300',
    accentBg: 'bg-orange-50/70',
    objective: 'Reactivar avance tras más de 24 horas sin nueva actividad académica.',
    baseMessage: `¡Muy buen día, [NOMBRE]! 👋

Observo que no se han registrado avances recientes en sus actividades del curso.

Le invito cordialmente a retomarlas para continuar avanzando y evitar contratiempos con las fechas de entrega.

Si presenta alguna dificultad técnica o requiere apoyo académico, por favor comuníquese conmigo para buscar una solución conjunta.

Quedo a su disposición si requiere orientación.

¡Mucho éxito!`,
    emoji: '🟠',
  },
  VERDE: {
    title: 'AVANZANDO',
    state: 'VERDE',
    colorName: 'Verde',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    badgeText: 'text-emerald-900',
    borderColor: 'border-emerald-300',
    accentBg: 'bg-emerald-50/70',
    objective: 'Felicitar al alumno por su constancia y progreso.',
    baseMessage: `¡Muy buen avance, [NOMBRE]! 🌟

Le felicito por la constancia y el avance que ha mostrado hasta este momento en la plataforma.

Le invito a mantener este ritmo de trabajo para concluir satisfactoriamente las actividades que tiene pendientes dentro de los plazos establecidos.

Quedo a su disposición para apoyarle en caso de requerir orientación.

¡Mucho éxito!`,
    emoji: '🟢',
  },
  AZUL: {
    title: 'TERMINÓ',
    state: 'AZUL',
    colorName: 'Azul',
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
    badgeText: 'text-blue-900',
    borderColor: 'border-blue-300',
    accentBg: 'bg-blue-50/70',
    objective: 'Reconocer la conclusión exitosa del curso.',
    baseMessage: `¡Felicidades, [NOMBRE]! 🎉

¡Muchas felicidades por haber concluido satisfactoriamente las actividades del curso! Reconozco su esfuerzo, compromiso y dedicación a lo largo de este periodo de aprendizaje.

Asimismo, le comparto el enlace institucional donde podrá consultar y descargar su constancia de acreditación una vez que se encuentre disponible:
https://innovacioneducativa.imss.gob.mx/deps/

Le deseo mucho éxito en sus futuros proyectos académicos y profesionales. ¡Enhorabuena!`,
    emoji: '🔵',
  },
  NEGRO: {
    title: 'REV. CALIF.',
    state: 'NEGRO',
    colorName: 'Negro',
    badgeBg: 'bg-slate-900 text-white border-slate-950',
    badgeText: 'text-slate-950',
    borderColor: 'border-slate-800',
    accentBg: 'bg-slate-100',
    objective: 'Revisar calificación que requiere atención (<80 pts).',
    baseMessage: `¡Muy buen día, [NOMBRE]! 👀

Noté que realizó la evaluación [UNIDAD].

Aunque en esta ocasión no se alcanzó una calificación aprobatoria, le sugiero revisar los comentarios y consultar el foro de Capsul-IMSS y CAST-sulitas, donde encontrará recursos didácticos de apoyo y conceptos clave para reforzar sus conocimientos antes de solicitar o realizar un nuevo intento.

Quedo a su disposición para apoyarle en caso de requerir orientación.

¡Mucho éxito!`,
    emoji: '⚫',
  },
  INICIADO_PRIMER_CORTE: {
    title: 'INICIADO',
    state: 'INICIADO_PRIMER_CORTE',
    colorName: 'Gris',
    badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
    badgeText: 'text-slate-800',
    borderColor: 'border-slate-300',
    accentBg: 'bg-slate-50',
    objective: 'Registro inicial de actividades.',
    baseMessage: `¡Muy buen día, [NOMBRE]! 👋

Se ha registrado su inicio en las actividades del curso. Le invito a continuar con el avance programado en las unidades de estudio.

Quedo a su disposición para apoyarle en caso de requerir orientación.

¡Mucho éxito!`,
    emoji: '⚪',
  },
};

export function getInterventionDetails(state: TutorialState): InterventionInfo {
  return INTERVENTIONS[state] || INTERVENTIONS.ROJO;
}

/**
 * Obtiene el nombre real del alumno respetando los datos de Excel.
 * Da preferencia al campo «Nombre», sin agregar automáticamente los apellidos.
 */
export function getStudentFirstName(student: {
  nombre?: string;
  nombreCompleto?: string;
  apellidos?: string;
}): string {
  if (student.nombre && typeof student.nombre === 'string' && student.nombre.trim()) {
    return student.nombre.trim();
  }
  if (student.nombreCompleto && typeof student.nombreCompleto === 'string' && student.nombreCompleto.trim()) {
    const full = student.nombreCompleto.trim();
    if (student.apellidos && typeof student.apellidos === 'string' && student.apellidos.trim()) {
      const apellidos = student.apellidos.trim();
      if (full.endsWith(apellidos)) {
        const withoutApellidos = full.substring(0, full.length - apellidos.length).trim();
        if (withoutApellidos) return withoutApellidos;
      }
    }
    const firstWord = full.split(/\s+/)[0];
    return firstWord || full;
  }
  return 'alumno(a)';
}

/**
 * Identifica la unidad de evaluación que realmente no fue aprobatoria (< 80 pts).
 */
export function resolveIssueUnitIdentifier(
  issues?: StudentEvaluationIssue[],
  context?: {
    currentUnitKey?: string;
    currentUnit?: number;
  }
): string {
  if (issues && issues.length > 0) {
    // Buscar la evaluación que no alcanzó calificación aprobatoria (< 80)
    const failingIssue = issues.find((i) => typeof i.score === 'number' && i.score < 80) || issues[0];
    if (failingIssue.formattedIdentifier) {
      return failingIssue.formattedIdentifier;
    }
    if (failingIssue.unitKey) {
      return formatAcademicUnitIdentifier(failingIssue.unitKey, failingIssue.unitNumber, failingIssue.moduleNumber);
    }
    if (failingIssue.unitNumber && failingIssue.unitNumber > 0) {
      return `U${failingIssue.unitNumber}`;
    }
    if (failingIssue.type === 'final') {
      return 'Evaluación Final';
    }
  }
  if (context?.currentUnitKey) {
    return formatAcademicUnitIdentifier(context.currentUnitKey, context.currentUnit);
  }
  if (context?.currentUnit && context.currentUnit > 0) {
    return `U${context.currentUnit}`;
  }
  return 'U1';
}

export function generatePersonalizedMessage(
  nombre: string,
  state: TutorialState,
  context?: {
    currentUnit?: number;
    currentUnitKey?: string;
    changeDetected?: string;
    issues?: StudentEvaluationIssue[];
    hasPendingEvaluation?: boolean;
    hasPendingTask?: boolean;
    hasPendingBoth?: boolean;
  }
): string {
  // Limpiar el nombre del alumno removiendo cualquier corchete residual
  let cleanName = (nombre || 'alumno(a)').replace(/^\[+|\]+$/g, '').trim();
  if (!cleanName) cleanName = 'alumno(a)';

  const info = getInterventionDetails(state);
  let msg = info.baseMessage;

  if (state === 'NEGRO') {
    const unitLabel = resolveIssueUnitIdentifier(context?.issues, context);
    const failingIssues = (context?.issues || []).filter((i) => typeof i.score === 'number' && i.score < 80);
    const hasTask = failingIssues.some((i) => i.type === 'task');
    const hasEval = failingIssues.some((i) => i.type === 'unit' || i.type === 'final');

    let activityPhrase = 'la evaluación';
    if (hasTask && hasEval) {
      activityPhrase = 'la tarea y la evaluación';
    } else if (hasTask) {
      activityPhrase = 'la tarea';
    } else {
      activityPhrase = 'la evaluación';
    }

    if (failingIssues.length === 1 && failingIssues[0].type === 'final') {
      msg = msg.replace(/la evaluación \[UNIDAD\]/gi, 'la Evaluación Final');
    } else {
      msg = msg.replace(/la evaluación \[UNIDAD\]/gi, `${activityPhrase} ${unitLabel}`);
      msg = msg.replace(/la tarea \[UNIDAD\]/gi, `${activityPhrase} ${unitLabel}`);
      msg = msg.replace(/la tarea y la evaluación \[UNIDAD\]/gi, `${activityPhrase} ${unitLabel}`);
    }
    msg = msg.replace(/\[UNIDAD\]/g, unitLabel);
  }

  // Sustituir [NOMBRE] por el nombre real del alumno sin corchetes
  msg = msg.replace(/\[NOMBRE\]/gi, cleanName);

  return msg;
}

/**
 * Fuente única de personalización de mensajes para cualquier alumno en la aplicación.
 * Consulta las plantillas más recientes y preserva los mensajes editados manualmente por el tutor.
 */
export function getStudentPersonalizedMessage(student: ProcessedStudent): string {
  // Si el tutor editó manualmente el mensaje de este alumno, respetarlo y no sobrescribirlo
  if (student.isManualMessage && student.personalizedMessage) {
    return student.personalizedMessage;
  }

  const firstName = getStudentFirstName(student);
  return generatePersonalizedMessage(firstName, student.state, {
    currentUnit: student.currentUnit,
    currentUnitKey: student.currentUnitKey,
    changeDetected: student.changeDetected,
    issues: student.issues,
  });
}
