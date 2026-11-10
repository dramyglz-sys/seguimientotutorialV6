import {
  CourseState,
  CourseSummary,
  InsigniaRecord,
  InsigniaType,
  TutorialResolution,
  TutorialResolutionType,
} from '../types';
import { inferInsignia } from './insignia';
import { compareCuts, buildHistoricalSteps } from './excelParser';
import { getInterventionDetails, getStudentPersonalizedMessage } from './messages';

const DB_NAME = 'SeguimientoTutorialDB';
const DB_VERSION = 3;
const COURSES_STORE = 'courses';
const SETTINGS_STORE = 'settings';
const RESOLUTIONS_STORE = 'tutorialResolutions';
const INSIGNIAS_STORE = 'manualInsignias';
const ACTIVE_COURSE_KEY = 'activeCourseId';

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for multiple independent courses
      if (!db.objectStoreNames.contains(COURSES_STORE)) {
        db.createObjectStore(COURSES_STORE, { keyPath: 'id' });
      }

      // Store for app settings (e.g. activeCourseId)
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }

      // Store for manual tutorial resolutions (CourseID + Usuario)
      if (!db.objectStoreNames.contains(RESOLUTIONS_STORE)) {
        db.createObjectStore(RESOLUTIONS_STORE, { keyPath: 'id' });
      }

      // Store for manual insignia classifications (CourseID + Usuario)
      if (!db.objectStoreNames.contains(INSIGNIAS_STORE)) {
        db.createObjectStore(INSIGNIAS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Saves or updates a course in its independent space in IndexedDB.
 */
export async function saveCourse(state: CourseState): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([COURSES_STORE, SETTINGS_STORE], 'readwrite');
    const coursesStore = transaction.objectStore(COURSES_STORE);
    const settingsStore = transaction.objectStore(SETTINGS_STORE);

    // Save the course state
    coursesStore.put(state);
    // Mark it as the active course
    settingsStore.put(state.id, ACTIVE_COURSE_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Retrieves a single course by its ID, merging saved resolutions and insignias.
 */
export async function getCourse(id: string): Promise<CourseState | null> {
  try {
    const db = await openDatabase();
    const course = await new Promise<CourseState | null>((resolve, reject) => {
      const transaction = db.transaction(COURSES_STORE, 'readonly');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });

    if (!course) return null;

    // Load persisted resolutions & insignias for this specific course
    const [resolutions, insignias] = await Promise.all([
      getTutorialResolutionsForCourse(id),
      getManualInsigniasForCourse(id),
    ]);

    course.tutorialResolutions = { ...(course.tutorialResolutions || {}), ...resolutions };
    course.manualInsignias = { ...(course.manualInsignias || {}), ...insignias };

    // Auto-repair currentComparison if missing or incomplete and raw sheet data is available
    if (
      (!course.currentComparison || !Array.isArray(course.currentComparison.students)) &&
      course.validSheets &&
      course.validSheets.length > 0 &&
      course.allCutSheetsData &&
      course.academicUnits
    ) {
      try {
        if (course.validSheets.length === 1) {
          const singleSheet = course.validSheets[0];
          const singleData = course.allCutSheetsData[singleSheet.raw] || [];
          course.currentComparison = compareCuts(
            null,
            singleData,
            null,
            singleSheet,
            course.academicUnits,
            course.tutorialResolutions,
            course.manualInsignias
          );
        } else {
          const prevSheet = course.validSheets[course.validSheets.length - 2];
          const currSheet = course.validSheets[course.validSheets.length - 1];
          const prevData = course.allCutSheetsData[prevSheet.raw] || [];
          const currData = course.allCutSheetsData[currSheet.raw] || [];
          course.currentComparison = compareCuts(
            prevData,
            currData,
            prevSheet,
            currSheet,
            course.academicUnits,
            course.tutorialResolutions,
            course.manualInsignias,
            { validSheets: course.validSheets, allCutSheetsData: course.allCutSheetsData }
          );
        }

        // Also reconstruct history if missing
        if (!course.history || course.history.length === 0) {
          course.history = buildHistoricalSteps(
            course.validSheets,
            course.allCutSheetsData,
            course.academicUnits
          );
        }

        // Persist the repaired comparison in background so subsequent loads are immediate
        const updateTx = db.transaction(COURSES_STORE, 'readwrite');
        updateTx.objectStore(COURSES_STORE).put(course);
      } catch (repairErr) {
        console.warn('Could not auto-repair currentComparison for course:', repairErr);
      }
    }

    // Ensure all historical steps have newEnrollmentCount populated
    if (course.history && Array.isArray(course.history) && course.allCutSheetsData) {
      course.history.forEach((step) => {
        if (typeof step.newEnrollmentCount !== 'number') {
          const prevD = course.allCutSheetsData[step.fromSheet] || [];
          const currD = course.allCutSheetsData[step.toSheet] || [];
          const prevSet = new Set<string>();
          prevD.forEach((r) => {
            const u = (r.usuario || '').trim().toLowerCase();
            if (u) prevSet.add(u);
          });
          let count = 0;
          currD.forEach((r) => {
            const u = (r.usuario || '').trim().toLowerCase();
            if (u && !prevSet.has(u)) count++;
          });
          step.newEnrollmentCount = count;
        }
      });
    }

    // Apply to current students
    if (course.currentComparison && Array.isArray(course.currentComparison.students)) {
      const isMultiCut = Boolean(course.validSheets && course.validSheets.length >= 2);
      const prevCutSheet = isMultiCut ? course.validSheets[course.validSheets.length - 2] : null;
      const prevData = (isMultiCut && prevCutSheet && course.allCutSheetsData)
        ? course.allCutSheetsData[prevCutSheet.raw] || []
        : [];
      const prevUsersSet = new Set<string>();
      if (isMultiCut && prevData.length > 0) {
        prevData.forEach((r) => {
          const u = (r.usuario || '').trim().toLowerCase();
          if (u) prevUsersSet.add(u);
        });
      }

      let newEnrollmentCount = 0;

      course.currentComparison.students.forEach((student) => {
        const uKey = student.usuario;
        const normUser = (uKey || '').trim().toLowerCase();

        // 0. NUEVO INGRESO: Alumno en corte actual que no aparecía en el corte inmediatamente anterior
        if (isMultiCut && prevUsersSet.size > 0 && normUser) {
          student.isNewEnrollment = !prevUsersSet.has(normUser);
        } else {
          student.isNewEnrollment = false;
        }

        if (student.isNewEnrollment) {
          newEnrollmentCount += 1;
          // Regla 4: Un alumno de nuevo ingreso NUNCA debe clasificarse en NARANJA
          if (student.state === 'NARANJA') {
            student.state = 'AMARILLO';
            student.stateLabel = 'PAUSA';
          }
        }

        // 1. Insignia: preservar selecciones manuales y actualizar automáticas con el catálogo ampliado
        const manualSaved = course.manualInsignias ? course.manualInsignias[uKey] : undefined;
        if (manualSaved) {
          student.insignia = manualSaved;
          student.isManualInsignia = true;
        } else if (student.isManualInsignia && student.insignia) {
          student.insignia = student.insignia;
          student.isManualInsignia = true;
        } else {
          student.insignia = inferInsignia(student.nombre, student.nombreCompleto);
          student.isManualInsignia = false;
        }

        // 2. Tutorial Resolution
        const resData = course.tutorialResolutions ? course.tutorialResolutions[uKey] : undefined;
        if (student.state === 'NEGRO') {
          const currentFailedIssue = student.issues && student.issues.length > 0 ? student.issues[0] : null;
          if (resData) {
            // Check if resolution matches current failing unit
            const sameUnit =
              !resData.issueUnit ||
              !currentFailedIssue ||
              resData.issueUnit === currentFailedIssue.unitNumber;

            if (sameUnit) {
              student.tutorialResolution =
                resData.resolution === 'Reprobó'
                  ? 'N.A'
                  : (resData.resolution as TutorialResolutionType);
              student.tutorialResolutionData = resData;
            } else {
              student.tutorialResolution = 'Pendiente de revisión';
            }
          } else {
            student.tutorialResolution = 'Pendiente de revisión';
          }
        } else {
          // If student state is not NEGRO (e.g. passed or no issue), do not show active resolution
          student.tutorialResolution = undefined;
          if (resData) {
            student.tutorialResolutionData = resData;
          }
        }

        // 3. Sincronizar mensaje tutorial y objetivo con la fuente única, respetando ediciones manuales
        if (!student.isManualMessage) {
          student.personalizedMessage = getStudentPersonalizedMessage(student);
        }
        student.recommendedIntervention = getInterventionDetails(student.state).objective;
      });
      course.currentComparison.newEnrollmentCount = newEnrollmentCount;
    }

    return course;
  } catch (err) {
    console.error('Error fetching course by ID:', err);
    return null;
  }
}

/**
 * Retrieves summary metadata for all stored courses.
 */
export async function getAllCoursesSummaries(): Promise<CourseSummary[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(COURSES_STORE, 'readonly');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const courses = (request.result || []) as CourseState[];
        const summaries: CourseSummary[] = courses.map((c) => {
          const lastSheet = c.validSheets && c.validSheets.length > 0
            ? c.validSheets[c.validSheets.length - 1]
            : null;
          return {
            id: c.id,
            name: c.courseMetadata?.name || 'Curso sin nombre',
            startDate: c.courseMetadata?.startDate || '',
            endDate: c.courseMetadata?.endDate || '',
            lastCutSheet: lastSheet ? lastSheet.raw : c.currentComparison?.currentSheetName || '',
            lastCutDateFormatted: lastSheet ? lastSheet.formatted : c.currentComparison?.currentDate?.formatted || '',
            totalStudents: c.currentComparison?.totalStudents || 0,
            lastUpdated: c.lastUpdated || '',
            courseType: c.courseType || c.courseMetadata?.courseType || c.currentComparison?.courseType,
          };
        });
        resolve(summaries);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Deletes a course and its associated resolutions and insignias from IndexedDB.
 */
export async function deleteCourse(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [COURSES_STORE, SETTINGS_STORE, RESOLUTIONS_STORE, INSIGNIAS_STORE],
      'readwrite'
    );
    const coursesStore = transaction.objectStore(COURSES_STORE);
    const settingsStore = transaction.objectStore(SETTINGS_STORE);
    const resStore = transaction.objectStore(RESOLUTIONS_STORE);
    const insStore = transaction.objectStore(INSIGNIAS_STORE);

    coursesStore.delete(id);

    // Clean up active key if needed
    const activeReq = settingsStore.get(ACTIVE_COURSE_KEY);
    activeReq.onsuccess = () => {
      if (activeReq.result === id) {
        settingsStore.delete(ACTIVE_COURSE_KEY);
      }
    };

    // Clean up resolution entries for this course
    const resReq = resStore.getAll();
    resReq.onsuccess = () => {
      const items = (resReq.result || []) as (TutorialResolution & { id: string })[];
      items.forEach((item) => {
        if (item.courseId === id) {
          resStore.delete(item.id);
        }
      });
    };

    // Clean up insignia entries for this course
    const insReq = insStore.getAll();
    insReq.onsuccess = () => {
      const items = (insReq.result || []) as (InsigniaRecord & { id: string })[];
      items.forEach((item) => {
        if (item.courseId === id) {
          insStore.delete(item.id);
        }
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Gets the ID of the currently active course.
 */
export async function getActiveCourseId(): Promise<string | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SETTINGS_STORE, 'readonly');
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get(ACTIVE_COURSE_KEY);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Sets the active course ID in settings.
 */
export async function setActiveCourseId(id: string | null): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    if (id) {
      store.put(id, ACTIVE_COURSE_KEY);
    } else {
      store.delete(ACTIVE_COURSE_KEY);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Loads the currently active course, or the most recent one.
 */
export async function loadActiveCourse(): Promise<CourseState | null> {
  const activeId = await getActiveCourseId();
  if (activeId) {
    const course = await getCourse(activeId);
    if (course) return course;
  }

  // Fallback to the first available course if activeId is not set
  const summaries = await getAllCoursesSummaries();
  if (summaries.length > 0) {
    const first = await getCourse(summaries[0].id);
    if (first) {
      await setActiveCourseId(first.id);
      return first;
    }
  }

  return null;
}

/**
 * Persists a tutorial resolution for a student in a course.
 * Key: `${courseId}_${usuario}`
 */
export async function saveTutorialResolution(
  courseId: string,
  usuario: string,
  resolution: TutorialResolutionType,
  issueUnit?: number,
  issueScore?: number,
  evaluationId?: string
): Promise<TutorialResolution> {
  const db = await openDatabase();
  const id = `${courseId}_${usuario}`;
  const record: TutorialResolution = {
    id,
    courseId,
    usuario,
    resolution,
    resolutionDate: new Date().toISOString(),
    issueUnit,
    issueScore,
    evaluationId: evaluationId || (issueUnit ? `U${issueUnit}` : undefined),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RESOLUTIONS_STORE], 'readwrite');
    const store = transaction.objectStore(RESOLUTIONS_STORE);
    store.put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Retrieves all saved tutorial resolutions for a specific course.
 */
export async function getTutorialResolutionsForCourse(
  courseId: string
): Promise<Record<string, TutorialResolution>> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(RESOLUTIONS_STORE, 'readonly');
      const store = transaction.objectStore(RESOLUTIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as (TutorialResolution & { id: string })[];
        const map: Record<string, TutorialResolution> = {};
        for (const item of list) {
          if (item.courseId === courseId) {
            map[item.usuario] = item;
          }
        }
        resolve(map);
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

/**
 * Persists a manual INSIGNIA classification for a student in a course.
 * Key: `${courseId}_${usuario}`
 */
export async function saveManualInsignia(
  courseId: string,
  usuario: string,
  insignia: InsigniaType
): Promise<InsigniaRecord> {
  const db = await openDatabase();
  const id = `${courseId}_${usuario}`;
  const record: InsigniaRecord = {
    id,
    courseId,
    usuario,
    insignia,
    isManual: true,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([INSIGNIAS_STORE], 'readwrite');
    const store = transaction.objectStore(INSIGNIAS_STORE);
    store.put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Retrieves all manual INSIGNIA classifications for a specific course.
 */
export async function getManualInsigniasForCourse(
  courseId: string
): Promise<Record<string, InsigniaType>> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(INSIGNIAS_STORE, 'readonly');
      const store = transaction.objectStore(INSIGNIAS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as (InsigniaRecord & { id: string })[];
        const map: Record<string, InsigniaType> = {};
        for (const item of list) {
          if (item.courseId === courseId) {
            map[item.usuario] = item.insignia;
          }
        }
        resolve(map);
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

// Aliases for compatibility
export const saveCourseState = saveCourse;
export const loadCourseById = getCourse;
export const deleteCourseById = deleteCourse;
export const loadCourseState = loadActiveCourse;
