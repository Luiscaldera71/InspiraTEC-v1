/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Type, Chat } from '@google/genai';

// Declare third-party libraries loaded from CDN
declare const html2canvas: any;
declare const jspdf: any;
declare const firebase: any;

/**
 * Escapes HTML special characters to prevent them from being interpreted as HTML tags.
 * @param unsafe The string to escape.
 * @returns The escaped string.
 */
function escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// --- START FIREBASE SETUP ---
// These configuration values should be set in your hosting environment's environment variables.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const plansCollection = db.collection('plans');
// --- END FIREBASE SETUP ---


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelName = 'gemini-2.5-flash';

// Wizard state
let currentStep = 1;
const totalSteps = 4;
const formData: Record<string, string | boolean> = {};


// DOM Elements for Main Views
const authContainer = document.getElementById('auth-container') as HTMLDivElement;
const mainAppContainer = document.getElementById('main-app') as HTMLDivElement;
const wizardContainer = document.getElementById('wizard-container') as HTMLDivElement;
const outputSection = document.getElementById('output-section') as HTMLElement;
const helpSection = document.getElementById('help-section') as HTMLElement;

// DOM Elements for Auth
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const signupForm = document.getElementById('signup-form') as HTMLFormElement;
const loginEmailInput = document.getElementById('login-email') as HTMLInputElement;
const loginPasswordInput = document.getElementById('login-password') as HTMLInputElement;
const signupEmailInput = document.getElementById('signup-email') as HTMLInputElement;
const signupPasswordInput = document.getElementById('signup-password') as HTMLInputElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;
const signupError = document.getElementById('signup-error') as HTMLParagraphElement;
const showSignupLink = document.getElementById('show-signup') as HTMLAnchorElement;
const showLoginLink = document.getElementById('show-login') as HTMLAnchorElement;
const userSessionInfo = document.getElementById('user-session-info') as HTMLDivElement;
const userEmailSpan = document.getElementById('user-email') as HTMLSpanElement;
const logoutButton = document.getElementById('logout-button') as HTMLButtonElement;


// DOM Elements for Wizard
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const planOutputContainer = document.getElementById('plan-output-container') as HTMLDivElement;
const downloadPdfButton = document.getElementById('download-pdf-button') as HTMLButtonElement;
const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLDivElement;
const sugerirIdeasButton = document.getElementById('sugerirIdeasButton') as HTMLButtonElement;
const sugerirEstandaresButton = document.getElementById('sugerirEstandaresButton') as HTMLButtonElement;

// DOM Elements for Manual Editing
const editorActions = document.getElementById('editor-actions') as HTMLDivElement;
const saveEditButton = document.getElementById('save-edit-button') as HTMLButtonElement;
const cancelEditButton = document.getElementById('cancel-edit-button') as HTMLButtonElement;
let originalPlanHtml = '';


// DOM Elements for Rubric
const generateRubricButton = document.getElementById('generate-rubric-button') as HTMLButtonElement;
const rubricSectionDetails = document.getElementById('rubric-section-details') as HTMLDetailsElement;
const rubricOutputContainer = document.getElementById('rubric-output-container') as HTMLDivElement;

// DOM Elements for Slides
const generateSlidesButton = document.getElementById('generate-slides-button') as HTMLButtonElement;
const slidesSectionDetails = document.getElementById('slides-section-details') as HTMLDetailsElement;
const slidesOutputContainer = document.getElementById('slides-output-container') as HTMLDivElement;
let slidesData: any[] = [];
let currentSlideIndex = 0;


// DOM Elements for Interactive Activities
const generateQuizButton = document.getElementById('generate-quiz-button') as HTMLButtonElement;
const generateWordsearchButton = document.getElementById('generate-wordsearch-button') as HTMLButtonElement;
const interactiveActivitiesSectionDetails = document.getElementById('interactive-activities-section-details') as HTMLDetailsElement;
const interactiveActivitiesContainer = document.getElementById('interactive-activities-container') as HTMLDivElement;


// DOM Elements for PDF Modal
const downloadModal = document.getElementById('download-modal') as HTMLDivElement;
const confirmDownloadButton = document.getElementById('confirm-download-button') as HTMLButtonElement;
const cancelDownloadButton = document.getElementById('cancel-download-button') as HTMLButtonElement;
const downloadPlanCheckbox = document.getElementById('download-plan-checkbox') as HTMLInputElement;
const downloadRubricCheckbox = document.getElementById('download-rubric-checkbox') as HTMLInputElement;
const downloadSlidesCheckbox = document.getElementById('download-slides-checkbox') as HTMLInputElement;
const downloadActivitiesCheckbox = document.getElementById('download-activities-checkbox') as HTMLInputElement;

// DOM Elements for Saved Plans (Firestore)
const savePlanButton = document.getElementById('save-plan-button') as HTMLButtonElement;
const savedPlansModal = document.getElementById('saved-plans-modal') as HTMLDivElement;
const closeSavedPlansButton = document.getElementById('close-saved-plans-button') as HTMLButtonElement;
const savedPlansList = document.getElementById('saved-plans-list') as HTMLDivElement;

// Navigation Buttons
const navInicioButton = document.getElementById('nav-inicio-button') as HTMLButtonElement;
const navMisPlanesButton = document.getElementById('nav-mis-planes-button') as HTMLButtonElement;
const navAyudaButton = document.getElementById('nav-ayuda-button') as HTMLButtonElement;

// DOM Elements for Feedback
const feedbackSectionDetails = document.getElementById('feedback-section-details') as HTMLDetailsElement;
const feedbackForm = document.getElementById('feedback-form') as HTMLFormElement;
const feedbackTextInput = document.getElementById('feedback-text') as HTMLTextAreaElement;
const feedbackPhotosInput = document.getElementById('feedback-photos') as HTMLInputElement;
const feedbackPhotoPreviews = document.getElementById('feedback-photo-previews') as HTMLDivElement;
const submitFeedbackButton = document.getElementById('submit-feedback-button') as HTMLButtonElement;
const feedbackDisplay = document.getElementById('feedback-display') as HTMLDivElement;


let currentPlanId: string | null = null;
let currentPlanData: any = {};
let planMarkdown = '';
let chat: Chat | null = null;


// Form field elements
const nombreClaseElement = document.getElementById('nombreClase') as HTMLInputElement;
const nivelEducativoElement = document.getElementById('nivelEducativo') as HTMLSelectElement;
const materiaElement = document.getElementById('materia') as HTMLInputElement;
const duracionClaseElement = document.getElementById('duracionClase') as HTMLInputElement;
const disponibilidadRecursosElement = document.getElementById('disponibilidadRecursos') as HTMLSelectElement;
const metodologiaElement = document.getElementById('metodologia') as HTMLSelectElement;
const queAprendenElement = document.getElementById('queAprenden') as HTMLTextAreaElement;
const estandaresObjetivosElement = document.getElementById('estandaresObjetivos') as HTMLTextAreaElement;
const adaptacionVisualElement = document.getElementById('adaptacionVisual') as HTMLInputElement;
const adaptacionAuditivaElement = document.getElementById('adaptacionAuditiva') as HTMLInputElement;
const adaptacionMotoraElement = document.getElementById('adaptacionMotora') as HTMLInputElement;
const adaptacionOtraElement = document.getElementById('adaptacionOtra') as HTMLInputElement;

// Sidebar Buttons
const sidebarGeneratePlanBtn = document.getElementById('sidebar-generate-plan') as HTMLButtonElement;
const sidebarSavePlanBtn = document.getElementById('sidebar-save-plan') as HTMLButtonElement;
const sidebarEditPlanBtn = document.getElementById('sidebar-edit-plan') as HTMLButtonElement;
const sidebarAIAssistantBtn = document.getElementById('sidebar-ai-assistant') as HTMLButtonElement;
const sidebarGenerateRubricBtn = document.getElementById('sidebar-generate-rubric') as HTMLButtonElement;
const sidebarGenerateSlidesBtn = document.getElementById('sidebar-generate-slides') as HTMLButtonElement;
const sidebarGenerateQuizBtn = document.getElementById('sidebar-generate-quiz') as HTMLButtonElement;
const sidebarGenerateWordsearchBtn = document.getElementById('sidebar-generate-wordsearch') as HTMLButtonElement;
const sidebarDownloadPdfBtn = document.getElementById('sidebar-download-pdf') as HTMLButtonElement;
const sidebarResetBtn = document.getElementById('sidebar-reset') as HTMLButtonElement;

// AI Assistant Panel
const aiAssistantPanel = document.getElementById('ai-assistant-panel') as HTMLDivElement;
const aiAssistantMessages = document.getElementById('ai-assistant-messages') as HTMLDivElement;
const aiAssistantForm = document.getElementById('ai-assistant-form') as HTMLFormElement;
const aiAssistantInput = document.getElementById('ai-assistant-input') as HTMLInputElement;
const aiAssistantSendBtn = document.getElementById('ai-assistant-send-btn') as HTMLButtonElement;
const aiAssistantCloseBtn = document.getElementById('ai-assistant-close-btn') as HTMLButtonElement;

// DOM Elements for Fullscreen Slide Modal
const fullscreenSlideModal = document.getElementById('fullscreen-slide-modal') as HTMLDivElement;
const closeFullscreenSlideBtn = document.getElementById('close-fullscreen-slide-btn') as HTMLButtonElement;
const fullscreenSlideViewer = document.getElementById('fullscreen-slide-viewer') as HTMLDivElement;
const fullscreenPrevBtn = document.getElementById('fullscreen-prev-slide-button') as HTMLButtonElement;
const fullscreenNextBtn = document.getElementById('fullscreen-next-slide-button') as HTMLButtonElement;
const fullscreenCounter = document.getElementById('fullscreen-slide-counter') as HTMLSpanElement;


function updateSidebarState() {
    const planGenerated = outputSection.style.display === 'block' && planMarkdown.length > 0;
    const isEditing = planOutputContainer.contentEditable === 'true';
    const isAssistantOpen = aiAssistantPanel.classList.contains('visible');
    const isLoggedIn = !!auth.currentUser;

    sidebarSavePlanBtn.style.display = planGenerated && isLoggedIn ? 'flex' : 'none';
    sidebarEditPlanBtn.style.display = planGenerated ? 'flex' : 'none';
    sidebarAIAssistantBtn.style.display = planGenerated ? 'flex' : 'none';
    sidebarGenerateRubricBtn.style.display = planGenerated ? 'flex' : 'none';
    sidebarGenerateSlidesBtn.style.display = planGenerated ? 'flex' : 'none';
    sidebarGenerateQuizBtn.style.display = planGenerated ? 'flex' : 'none';
    sidebarGenerateWordsearchBtn.style.display = planGenerated ? 'flex' : 'none';
    sidebarDownloadPdfBtn.style.display = planGenerated ? 'flex' : 'none';
    sidebarResetBtn.style.display = planGenerated ? 'flex' : 'none';

    // Disable buttons to prevent conflicts
    sidebarEditPlanBtn.disabled = isAssistantOpen || isEditing;
    sidebarAIAssistantBtn.disabled = isEditing;
    sidebarSavePlanBtn.disabled = isEditing;
    sidebarDownloadPdfBtn.disabled = isEditing;
    sidebarResetBtn.disabled = isEditing;


    // Disable generation buttons if they have already been used or if editing
    sidebarGenerateRubricBtn.disabled = isEditing || generateRubricButton.disabled;
    sidebarGenerateSlidesBtn.disabled = isEditing || generateSlidesButton.disabled;
    sidebarGenerateQuizBtn.disabled = isEditing || generateQuizButton.disabled;
    sidebarGenerateWordsearchBtn.disabled = isEditing || generateWordsearchButton.disabled;

    // The main generate button is only visible in the wizard
    sidebarGeneratePlanBtn.style.display = wizardContainer.style.display === 'block' ? 'flex' : 'none';
}

function navigateTo(page: 'wizard' | 'output' | 'help') {
    // Hide all main sections
    wizardContainer.style.display = 'none';
    outputSection.style.display = 'none';
    helpSection.style.display = 'none';

    // Remove active class from all nav buttons
    navInicioButton.classList.remove('active');
    navAyudaButton.classList.remove('active');
    
    // Show the selected section and update nav
    switch (page) {
        case 'wizard':
            wizardContainer.style.display = 'block';
            navInicioButton.classList.add('active');
            break;
        case 'output':
            outputSection.style.display = 'block';
            navInicioButton.classList.add('active'); // "Inicio" remains active as it's the context
            break;
        case 'help':
            helpSection.style.display = 'block';
            navAyudaButton.classList.add('active');
            break;
    }
    window.scrollTo(0, 0); // Scroll to top on navigation
    updateSidebarState();
}


function updateWizardView() {
  // Update form steps visibility
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.classList.remove('active-step');
  });
  document.getElementById(`step-${currentStep}`)?.classList.add('active-step');

  // Update progress bar
  const steps = progressBar.querySelectorAll('.progress-bar-step');
  steps.forEach((step, index) => {
    const stepNumber = index + 1;
    step.classList.remove('active', 'completed');
    if (stepNumber < currentStep) {
      step.classList.add('completed');
    } else if (stepNumber === currentStep) {
      step.classList.add('active');
    }
  });
  updateSidebarState();
}

function collectStepData(step: number) {
  switch (step) {
    case 1:
      formData.nombreClase = nombreClaseElement.value;
      formData.nivelEducativo = nivelEducativoElement.value; 
      formData.materia = materiaElement.value;
      formData.duracionClase = duracionClaseElement.value;
      formData.disponibilidadRecursos = disponibilidadRecursosElement.value;
      break;
    case 2:
      formData.metodologia = metodologiaElement.value;
      formData.queAprenden = queAprendenElement.value;
      break;
    case 3:
      formData.estandaresObjetivos = estandaresObjetivosElement.value;
      break;
    case 4:
      formData.adaptacionVisual = adaptacionVisualElement.checked;
      formData.adaptacionAuditiva = adaptacionAuditivaElement.checked;
      formData.adaptacionMotora = adaptacionMotoraElement.checked;
      formData.adaptacionOtra = adaptacionOtraElement.value;
      break;
  }
}

document.querySelectorAll('.next-button').forEach(button => {
  button.addEventListener('click', () => {
    collectStepData(currentStep);
    if (currentStep === 1 && (!formData.nombreClase || !formData.nivelEducativo || !formData.materia || !formData.duracionClase || !formData.disponibilidadRecursos)) {
        alert('Por favor, completa todos los campos de Información Básica.');
        return;
    }
     if (currentStep === 2 && (!formData.metodologia || !formData.queAprenden)) {
        alert('Por favor, completa todos los campos de Metodología y Contenido.');
        return;
    }
    if (currentStep === 3 && !formData.estandaresObjetivos) {
        alert('Por favor, completa los Estándares y Objetivos de Aprendizaje.');
        return;
    }
    if (currentStep < totalSteps) {
      currentStep++;
      updateWizardView();
    }
  });
});

document.querySelectorAll('.back-button').forEach(button => {
  button.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateWizardView();
    }
  });
});

async function generatePlanFromWizard(): Promise<string> {
    const adaptacionesSeleccionadas = [];
    if (formData.adaptacionVisual) adaptacionesSeleccionadas.push('discapacidad visual');
    if (formData.adaptacionAuditiva) adaptacionesSeleccionadas.push('discapacidad auditiva');
    if (formData.adaptacionMotora) adaptacionesSeleccionadas.push('discapacidad motora');
    if (formData.adaptacionOtra && (formData.adaptacionOtra as string).trim() !== '') {
        adaptacionesSeleccionadas.push((formData.adaptacionOtra as string).trim());
    }

    let adaptacionesInstruction = '';
    if (adaptacionesSeleccionadas.length > 0) {
        const listaAdaptaciones = adaptacionesSeleccionadas.join(', ');
        adaptacionesInstruction = `
11. ### Adaptaciones Inclusivas
    - **IMPORTANTE**: Esta sección es obligatoria. Basado en las necesidades seleccionadas (${listaAdaptaciones}), detalla estrategias, recursos y evaluaciones adaptadas para estudiantes con dichas necesidades.
    - Sigue las prácticas de Diseño Universal para el Aprendizaje (DUA) y los lineamientos de educación inclusiva de Colombia.
    - Ofrece sugerencias concretas y prácticas que se conecten con las actividades de la secuencia didáctica.
    - Organiza las sugerencias por tipo de necesidad para mayor claridad (ej. un subtítulo para "Discapacidad Visual", otro para "Discapacidad Auditiva", etc.).`;
    }

  const systemInstruction = `Eres un asistente experto en la creación de planes de clase de tecnología e informática para docentes en Colombia.
Tu objetivo es generar planes de clase detallados, creativos, innovadores y prácticos, adaptados al contexto educativo colombiano y al grado especificado.
El plan debe ser fácil de entender y aplicar por los docentes. Utiliza un lenguaje claro y motivador, y formatea el resultado con sintaxis markdown.

**IMPORTANTE**: Usa doble asterisco para texto en negrita (ej. **Título de Sección**). Usa solo un hashtag (#) para el título principal del plan, y tres hashtags (###) para los títulos de las secciones secundarias (ej. ### 1. Objetivos de Aprendizaje). Usa un guion (-) o asterisco (*) para los elementos de una lista.

Aquí tienes una lista de metodologías de enseñanza con sus descripciones. Cuando el usuario seleccione una, utiliza esta información para enriquecer la sección "Metodología de Enseñanza Propuesta" en el plan de clase:
1.  Clase magistral: El docente transmite el conocimiento de manera directa. El estudiante escucha, toma notas y asimila la información. Útil para introducir teorías como la historia de la informática, conceptos de algoritmos, redes o ética digital. Ventajas: Claridad, rapidez en la entrega de contenidos. Desventajas: Bajo nivel de participación.
2.  Aprendizaje activo: El estudiante participa de manera constante mediante actividades prácticas, discusiones y trabajo colaborativo. Aplicación: Talleres de programación, prácticas con software, creación de blogs o páginas web. Ventajas: Fomenta la participación, el pensamiento crítico y la retención de contenido.
3.  Aprendizaje práctico: Se enfoca en aplicar el conocimiento a situaciones reales del entorno laboral o cotidiano. Aplicación: Simulaciones de redes, uso de sensores con Arduino, robótica escolar. Ventajas: Relevancia para el mundo laboral, aprendizaje significativo.
4.  Aprendizaje social y emocional: Integra competencias socioemocionales como la empatía, el trabajo en equipo y la autorregulación. Aplicación: Proyectos colaborativos con roles definidos; resolución de conflictos al usar herramientas digitales. Ventajas: Clima de aula positivo, desarrollo integral del estudiante.
5.  DUA: Diseño Universal para el Aprendizaje: Ofrece múltiples formas de representación, expresión y motivación para aprender. Aplicación: Accesibilidad en herramientas TIC, diversidad de productos (videos, infografías, código). Ventajas: Inclusión, equidad y personalización del aprendizaje.
6.  Aprendizaje Basado en Casos: Se plantean situaciones reales o simuladas que los estudiantes deben analizar. Aplicación: Estudio de casos de ciberseguridad, ética en el uso de IA, fallos tecnológicos. Ventajas: Mejora la toma de decisiones, análisis y aplicación de conceptos.
7.  Aprendizaje Basado en Indagación: Parte de preguntas formuladas por los estudiantes, guiadas por el docente. Aplicación: ¿Cómo funciona una red? ¿Por qué un robot actúa así? Luego los estudiantes investigan y construyen respuestas. Ventajas: Estimula la curiosidad y la investigación autónoma.
8.  Aprendizaje Basado en Investigación: Proceso más estructurado que la indagación. Los estudiantes hacen investigaciones con métodos científicos. Aplicación: Investigación de impacto de la tecnología en la educación o la sociedad. Ventajas: Rigor metodológico, desarrollo del pensamiento científico.
9.  Aprendizaje Basado en Problemas (ABP): Planteamiento de un problema real o simulado para ser resolto en equipo. Aplicación: “La red de la escuela falla constantemente, ¿cómo lo solucionamos?” Ventajas: Desarrollo de habilidades de análisis, solución y colaboración.
10. Aprendizaje Basado en Proyectos (ABPro): Se plantea un producto final (tangible o digital) que se elabora durante un proceso de aprendizaje guiado. Aplicación: Crear un videojuego educativo, una app escolar o un prototipo robótico. Ventajas: Motivación, trabajo por etapas, integración de saberes.
11. Aprendizaje Basado en Retos: Los estudiantes enfrentan desafíos complejos y reales que exigen creatividad. Aplicación: Diseñar una solución para la recolección de residuos usando sensores. Ventajas: Desarrollo de la resiliencia, innovación, y pensamiento crítico.
12. Aprendizaje Colaborativo: Los estudiantes trabajan en grupos, compartiendo conocimientos y responsabilidades. Aplicación: Programación en pareja, resolución de tareas tecnológicas en equipo. Ventajas: Promueve la interacción social, co-creación y habilidades blandas.
13. Aprendizaje Invertido (Flipped Learning): Los estudiantes estudian contenidos en casa y aplican en clase mediante actividades prácticas. Aplicación: Videos de Scratch, tutoriales previos a la clase; en clase se crean proyectos. Ventajas: Mayor aprovechamiento del tiempo en clase, autonomía del estudiante.
14. Design Thinking: Enfoque centrado en el usuario, que sigue las etapas: empatizar, definir, idear, prototipar y evaluar. Aplicación: Crear una solución digital para estudiantes con dificultades de aprendizaje. Ventajas: Creatividad, pensamiento empático, prototipado rápido.
15. Gamificación: Uso de mecánicas de juego (retos, puntos, niveles) en el entorno educativo. Aplicación: Plataforma de retos de programación, insignias por logros tecnológicos. Ventajas: Mayor motivación y compromiso del estudiante.
16. Aprendizaje Servicio: Integración del aprendizaje con un servicio social o comunitario. Aplicación: Enseñar alfabetización digital a personas mayores en la comunidad. Ventajas: Impacto social, valores ciudadanos, aplicación del conocimiento.
17. Microlearning: Aprendizaje en cápsulas breves, enfocadas en objetivos puntuales. Aplicación: Videos o actividades de 5-10 minutos sobre comandos básicos de programación o uso de software. Ventajas: Ideal para repasar o introducir contenidos en TIC.
18. STEAM: Enfoque integrador de Ciencia, Tecnología, Ingeniería, Arte y Matemáticas. Aplicación: Proyecto de robótica que combine electrónica, diseño estético y resolución matemática. Ventajas: Interdisciplinariedad, creatividad, pensamiento computacional.
19. Pensamiento Computacional: Resolución de problemas siguiendo procesos lógicos como descomposición, abstracción y algoritmos. Aplicación: Resolución de retos con bloques de código o programación textual. Ventajas: Mejora la lógica, análisis, y preparación para la programación.

Si el usuario selecciona "Otra" como metodología, simplemente indica "Metodología específica definida por el docente" y sugiere que se detalle en las actividades.

Asegúrate de incluir los siguientes componentes en el plan de clase, bien estructurados con títulos claros para cada sección:
1.  **# Título del Plan de Clase** (creativo y relacionado con el tema)
2.  ### Información General
    - **Grado:** ${formData.nivelEducativo}
    - **Materia:** ${formData.materia}
    - **Tema Específico:** ${formData.nombreClase}
    - **Tiempo Estimado:** ${formData.duracionClase}
    - **Disponibilidad de Recursos:** ${formData.disponibilidadRecursos}
3.  ### Objetivos de Aprendizaje Específicos (basados en: "${formData.queAprenden}" y los estándares definidos)
4.  ### Estándares de Aprendizaje Involucrados (basados en: "${formData.estandaresObjetivos}")
5.  ### Metodología de Enseñanza Propuesta: (Aquí debes elaborar sobre la metodología seleccionada: ${formData.metodologia}, usando las descripciones provistas arriba. Si es "Otra", indica que el docente la especificará).
6.  ### Competencias a Desarrollar (mencionar competencias TIC y del siglo XXI relevantes para Colombia, como pensamiento crítico, resolución de problemas, colaboración, comunicación, ciudadanía digital)
7.  ### Recursos y Materiales Necesarios (ser específico: software, hardware, materiales físicos, enlaces a recursos web si aplica). **CRÍTICO: Tus sugerencias DEBEN ser 100% realistas y coherentes con la disponibilidad de recursos seleccionada. Si es un 'Aula Tradicional', NO sugieras computadoras o software. Si es un 'Espacio Maker', PUEDES sugerir impresoras 3D, etc. Adapta todas las actividades y recursos a este contexto.** Cuando sugieras un recurso visual que pueda ser generado (como una imagen, diagrama, esquema, ilustración), formatea la sugerencia de la siguiente manera: [GENERATE_IMAGE: "una descripción detallada de la imagen a generar"]. Por ejemplo: "Para la actividad de desarrollo, se necesitará [GENERATE_IMAGE: "un diagrama claro de las partes de una CPU, mostrando el ALU, la unidad de control y los registros"]. No uses este formato para software, hardware o materiales físicos.
8.  ### Secuencia Didáctica Detallada: **(Adapta las actividades para que sean realizables con los recursos disponibles)**
    - **a. Actividades de Inicio** (motivación, conocimientos previos, presentación del tema - aprox. 15% del tiempo)
    - **b. Actividades de Desarrollo** (explicación, demostración, práctica guiada, trabajo colaborativo - aprox. 60% del tiempo)
    - **c. Actividades de Cierre** (repaso, síntesis, aplicación, reflexión, próximos pasos - aprox. 25% del tiempo)
9.  ### Estrategias de Evaluación (sugerencias para evaluación formativa y sumativa, instrumentos, conectadas con los objetivos y estándares)
10. ### Observaciones Adicionales (opcional, para adaptaciones, interdisciplinariedad, etc.)
${adaptacionesInstruction}

Considera la información proporcionada por el usuario para cada sección.
Detalla especialmente la secuencia didáctica y las estrategias de evaluación, asegurando que sean coherentes con los recursos disponibles.
Elabora sobre los "conceptos y habilidades que los estudiantes deben desarrollar" y los "estándares y objetivos de aprendizaje" proporcionados por el usuario para crear secciones ricas y útiles.
`;

  const userPrompt = `Con base en la configuración detallada, genera el plan de clase.
Nombre de la Clase o Tema: ${formData.nombreClase}
Grado: ${formData.nivelEducativo}
Materia: ${formData.materia}
Duración de la Clase: ${formData.duracionClase}
Disponibilidad de Recursos: ${formData.disponibilidadRecursos}
Metodología de Enseñanza Seleccionada: ${formData.metodologia}
Conceptos y Habilidades a Desarrollar (¿Qué aprenderán?): ${formData.queAprenden}
Estándares y Objetivos de Aprendizaje (Detalles adicionales): ${formData.estandaresObjetivos}
${adaptacionesSeleccionadas.length > 0 ? `Adaptaciones Inclusivas Solicitadas: ${adaptacionesSeleccionadas.join(', ')}` : ''}

Por favor, crea un plan de clase completo y bien estructurado. Asegúrate de que la sección 'Metodología de Enseñanza Propuesta' describa adecuadamente la metodología seleccionada (${formData.metodologia}) basándote en el contexto que te he proporcionado. **Presta atención CRÍTICA a la disponibilidad de recursos y asegura que todas las actividades y materiales sugeridos sean viables en ese contexto.**${adaptacionesSeleccionadas.length > 0 ? '\nPresta especial atención a la sección "Adaptaciones Inclusivas", ofreciendo sugerencias detalladas y relevantes.' : ''}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    return response.text;
  } catch (error) {
    console.error('Error generating plan:', error);
    let errorMessage = 'Hubo un error al generar el plan. Por favor, revisa la consola para más detalles e inténtalo de nuevo.';
    if (error && typeof error === 'object' && 'message' in error) {
        errorMessage += `\nDetalle: ${error.message}`;
    }
    return errorMessage;
  }
}

async function generateImageResource(prompt: string, placeholder: HTMLElement, button: HTMLButtonElement) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `<div class="spinner-container"><span class="spinner"></span><p>Generando imagen...</p></div>`;
    button.innerHTML = '<span class="spinner"></span> Generando...';
    button.disabled = true;

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `A simple and clear educational illustration for a lesson plan about: "${prompt}". Friendly and colorful drawing style, suitable for students. Any text that appears in the image must be in English.`,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '4:3',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
            
            placeholder.innerHTML = `<img src="${imageUrl}" alt="${escapeHtml(prompt)}" class="generated-resource-image">`;
            button.style.display = 'none';
        } else {
            placeholder.innerHTML = `<p class="error-message">No se pudo generar una imagen. Por favor, reintenta la generación.</p>`;
            button.innerHTML = '🎨 Reintentar Generación';
            button.disabled = false;
        }

    } catch (error) {
        console.error('Error generating image resource:', error);
        let errorMessage = 'Ocurrió un error al generar la imagen.';
        const errorString = String(error);
        if (errorString.includes('429') || errorString.toUpperCase().includes('RESOURCE_EXHAUSTED')) {
            errorMessage = 'Se ha excedido la cuota de generación de imágenes. Por favor, inténtalo más tarde.';
        }
       
        placeholder.innerHTML = `<p class="error-message">${errorMessage}</p>`;
        button.innerHTML = '🎨 Reintentar Generación';
        button.disabled = false;
    }
}

async function displayGeneratedPlan(markdownText: string, isNewPlan = true) {
    planMarkdown = markdownText;

    if (isNewPlan) {
      initializeChat();
    }
    
    if (markdownText.startsWith('Hubo un error')) {
        planOutputContainer.innerHTML = `<p class="error-message">${escapeHtml(markdownText)}</p>`;
    } else if (!markdownText.trim()) {
        planOutputContainer.innerHTML = '<p>No se pudo generar contenido para el plan.</p>';
        planMarkdown = '';
    } else {
        const lines = markdownText.split('\n');
        let html = '';
        let inList = false;

        const processContent = (text: string) => {
            const escaped = escapeHtml(text);
            return escaped
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\[GENERATE_IMAGE: &quot;(.*?)&quot;\]/g, (match, promptContent) => {
                    return `<span class="generatable-resource-wrapper">
                                ${promptContent}
                                <button class="generate-image-button" data-prompt="${promptContent}">
                                    🎨 Generar Recurso
                                </button>
                                <div class="image-placeholder" style="display: none;"></div>
                            </span>`;
                });
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            if (inList && !line.startsWith('* ') && !line.startsWith('- ')) {
                html += '</ul>';
                inList = false;
            }
            
            const structuralLine = line.replace(/(\*\*|\*)/g, '').trim();

            if (structuralLine.startsWith('# ')) {
                const content = line.replace(/^\**\s*#\s*/, '').replace(/\**$/, '').trim();
                html += `<h2 class="plan-title">${processContent(content)}</h2>`;
            } else if (structuralLine.startsWith('##')) {
                const content = line.replace(/^\**\s*#{2,4}\s*/, '').replace(/\**$/, '').trim();
                html += `<h3>${processContent(content)}</h3>`;
            } else if (line.match(/^[a-c]\.\s+/i)) {
                html += `<h4>${processContent(line)}</h4>`;
            } else if (line.startsWith('* ') || line.startsWith('- ')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                const itemContent = line.substring(2);
                html += `<li>${processContent(itemContent)}</li>`;
            } else {
                html += `<p>${processContent(line)}</p>`;
            }
        }

        if (inList) {
            html += '</ul>';
        }
        planOutputContainer.innerHTML = html;
        currentPlanData.planHtml = html;
        currentPlanData.planMarkdown = planMarkdown;
    }

    if (planMarkdown && !planMarkdown.startsWith('Hubo un error')) {
        savePlanButton.style.display = 'inline-block';
        generateRubricButton.style.display = 'inline-block';
        generateSlidesButton.style.display = 'inline-block';
        generateQuizButton.style.display = 'inline-block';
        generateWordsearchButton.style.display = 'inline-block';
        downloadPdfButton.style.display = 'inline-block';
        resetButton.style.display = 'inline-block';
    } else {
        savePlanButton.style.display = 'none';
        generateRubricButton.style.display = 'none';
        generateSlidesButton.style.display = 'none';
        generateQuizButton.style.display = 'none';
        generateWordsearchButton.style.display = 'none';
        downloadPdfButton.style.display = 'none';
        resetButton.style.display = 'inline-block';
    }

    // Show feedback section only if plan is saved (has an ID)
    feedbackSectionDetails.style.display = currentPlanId ? 'block' : 'none';

    navigateTo('output');
    if(isNewPlan) outputSection.scrollIntoView({ behavior: 'smooth' });
    updateSidebarState();
}

planOutputContainer.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('.generate-image-button');

    if (button instanceof HTMLButtonElement && !button.disabled) {
        const prompt = button.dataset.prompt;
        const wrapper = button.parentElement;
        const placeholder = wrapper?.querySelector('.image-placeholder') as HTMLElement;

        if (prompt && placeholder) {
            await generateImageResource(prompt, placeholder, button);
        }
    }
});

generateButton.addEventListener('click', async () => {
  collectStepData(currentStep); 

    if (!formData.nombreClase || !formData.nivelEducativo || !formData.materia || !formData.duracionClase || !formData.disponibilidadRecursos) {
        alert('Información básica incompleta. Por favor, revisa el Paso 1.');
        currentStep = 1; updateWizardView(); return;
    }
    if (!formData.metodologia || !formData.queAprenden) {
        alert('Información de metodología y contenido incompleta. Por favor, revisa el Paso 2.');
        currentStep = 2; updateWizardView(); return;
    }
    if (!formData.estandaresObjetivos) {
        alert('Información de estándares y objetivos incompleta. Por favor, revisa el Paso 3.');
        currentStep = 3; updateWizardView(); return;
    }

  currentPlanId = null; // Reset the ID because this is a new generation.
  navigateTo('wizard'); // Ensure wizard is hidden, though it will be by loading overlay
  loadingOverlay.classList.add('visible');
  generateButton.disabled = true;
  updateSidebarState();
  
  try {
    const generatedPlan = await generatePlanFromWizard();
    await displayGeneratedPlan(generatedPlan, true);
  } catch(e) {
    console.error("Caught error in generate button event listener:", e);
    await displayGeneratedPlan("Se produjo un error inesperado. Por favor, inténtelo de nuevo más tarde.", true);
  } finally {
    loadingOverlay.classList.remove('visible');
    generateButton.disabled = false;
    updateSidebarState();
  }
});

async function convertImagesToBase64(container: HTMLElement) {
    const images = Array.from(container.querySelectorAll('img'));
    const promises = images.map(img => {
        if (img.src && (img.src.startsWith('https://drive.google.com/'))) {
            return fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(img.src)}`)
                .then(response => response.ok ? response.blob() : Promise.reject(`Failed to fetch image: ${response.statusText}`))
                .then(blob => new Promise<void>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => { img.src = reader.result as string; resolve(); };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }))
                .catch(error => {
                    console.error(`Could not convert image ${img.src} to Base64.`, error);
                });
        }
        return Promise.resolve();
    });
    await Promise.all(promises);
}


async function handlePdfGeneration() {
    const downloadPlan = downloadPlanCheckbox.checked;
    const downloadRubric = downloadRubricCheckbox.checked;
    const downloadSlides = downloadSlidesCheckbox.checked;
    const downloadActivities = downloadActivitiesCheckbox.checked;

    if (!downloadPlan && !downloadRubric && !downloadActivities && !downloadSlides) {
        alert('Por favor, selecciona al menos un elemento para descargar.');
        return;
    }

    const { jsPDF } = jspdf;
    downloadPdfButton.textContent = 'Generando...';
    downloadPdfButton.disabled = true;

    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    printContainer.style.width = '800px';
    printContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(printContainer);

    const headerElement = document.querySelector('header .header-content');
    if (headerElement) {
        const headerClone = headerElement.cloneNode(true) as HTMLElement;
        headerClone.style.marginBottom = '2rem';
        headerClone.style.borderBottom = '1px solid #ccc';
        headerClone.style.paddingBottom = '1rem';
        printContainer.appendChild(headerClone);
    }
    
    const createSectionForPrint = (title: string, contentElement: HTMLElement) => {
      const sectionWrapper = document.createElement('div');
      sectionWrapper.style.pageBreakBefore = 'always';
      
      const titleEl = document.createElement('h2');
      titleEl.textContent = title;
      titleEl.style.fontSize = '1.5rem';
      titleEl.style.borderBottom = '1px solid #eee';
      titleEl.style.paddingBottom = '0.5rem';
      titleEl.style.marginTop = '2rem';
      
      const contentClone = contentElement.cloneNode(true) as HTMLElement;
      
      sectionWrapper.appendChild(titleEl);
      sectionWrapper.appendChild(contentClone);
      return sectionWrapper;
    }

    if (downloadPlan) {
        const planClone = planOutputContainer.cloneNode(true) as HTMLElement;
        printContainer.appendChild(planClone);
    }
    if (downloadRubric) {
        printContainer.appendChild(createSectionForPrint("Rúbrica de Evaluación", rubricOutputContainer));
    }
    if (downloadSlides) {
        printContainer.appendChild(createSectionForPrint("Diapositivas de la Clase", slidesOutputContainer));
    }
    if (downloadActivities) {
        printContainer.appendChild(createSectionForPrint("Actividades Interactivas", interactiveActivitiesContainer));
    }
    
    await convertImagesToBase64(printContainer);

    try {
        const canvas = await html2canvas(printContainer, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const imgProps = pdf.getImageProperties(imgData);
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));
        
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position - margin, imgWidth, imgHeight);
            heightLeft -= (pdfHeight - (margin * 2));
        }

        pdf.save('inspiratec-documento.pdf');
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Hubo un error al generar el PDF.");
    } finally {
        document.body.removeChild(printContainer);
        downloadPdfButton.textContent = '📄 Descargar PDF';
        downloadPdfButton.disabled = false;
    }
}


resetButton.addEventListener('click', () => {
  for (const key in formData) { delete formData[key]; }
  nombreClaseElement.value = '';
  nivelEducativoElement.value = ''; 
  materiaElement.value = 'Tecnología e Informática'; 
  duracionClaseElement.value = '';
  disponibilidadRecursosElement.value = '';
  metodologiaElement.value = '';
  queAprendenElement.value = '';
  estandaresObjetivosElement.value = '';
  adaptacionVisualElement.checked = false;
  adaptacionAuditivaElement.checked = false;
  adaptacionMotoraElement.checked = false;
  adaptacionOtraElement.value = '';

  currentStep = 1;
  updateWizardView();
  navigateTo('wizard');

  planOutputContainer.innerHTML = '<p>Tu plan de clase aparecerá aquí.</p>';
  planMarkdown = '';
  rubricSectionDetails.style.display = 'none';
  rubricSectionDetails.open = false;
  rubricOutputContainer.innerHTML = '';
  slidesSectionDetails.style.display = 'none';
  slidesSectionDetails.open = false;
  slidesOutputContainer.innerHTML = '';
  slidesData = [];
  interactiveActivitiesSectionDetails.style.display = 'none';
  interactiveActivitiesSectionDetails.open = false;
  interactiveActivitiesContainer.innerHTML = '';
  feedbackSectionDetails.style.display = 'none';
  feedbackSectionDetails.open = false;
  feedbackDisplay.innerHTML = '';
  feedbackForm.reset();

  generateRubricButton.style.display = 'none';
  generateRubricButton.disabled = false;
  generateRubricButton.innerHTML = '✨ Generar Rúbrica';
  
  generateSlidesButton.style.display = 'none';
  generateSlidesButton.disabled = false;
  generateSlidesButton.textContent = '🖥️ Crear Diapositivas';

  generateQuizButton.style.display = 'none';
  generateQuizButton.disabled = false;
  generateQuizButton.textContent = '🧠 Generar Preguntas';

  generateWordsearchButton.style.display = 'none';
  generateWordsearchButton.disabled = false;
  generateWordsearchButton.textContent = '🧩 Crear Sopa de Letras';

  savePlanButton.style.display = 'none';
  downloadPdfButton.style.display = 'none';
  resetButton.style.display = 'none';
  
  generateButton.disabled = false;
  downloadModal.style.display = 'none';
  currentPlanData = {};
  currentPlanId = null; // Reset the plan ID

  chat = null;
  toggleAIAssistant(false);
  aiAssistantMessages.innerHTML = '';
  
  toggleEditView(false);

  updateSidebarState();
});

async function generateLearningObjectiveIdeas() {
    collectStepData(1);
    const nombreClase = formData.nombreClase;

    if (!nombreClase) {
        alert('Por favor, primero define el "Nombre de la clase o tema" en el Paso 1.');
        currentStep = 1; updateWizardView(); nombreClaseElement.focus(); return;
    }

    const button = sugerirIdeasButton;
    const buttonTextEl = button.querySelector('.suggester-button-text') as HTMLSpanElement;
    const spinner = button.querySelector('.spinner') as HTMLSpanElement;

    button.disabled = true;
    if(buttonTextEl) buttonTextEl.textContent = 'Generando...';
    if(spinner) spinner.style.display = 'inline-block';

    const systemInstruction = `Eres un asistente pedagógico experto. Tu tarea es ayudar a los docentes a definir qué aprenderán sus estudiantes. Responde de forma concisa y directa, solo con el texto solicitado.`;
    const userPrompt = `Para una clase sobre "${nombreClase}", escribe una lista de los conceptos y habilidades más importantes que los estudiantes deberían aprender.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: modelName, contents: userPrompt, config: { systemInstruction: systemInstruction } });
        queAprendenElement.value = response.text;
        queAprendenElement.focus();
        queAprendenElement.classList.add('highlight');
        setTimeout(() => { queAprendenElement.classList.remove('highlight'); }, 1000);
    } catch (error) {
        console.error('Error suggesting ideas:', error);
        alert('Hubo un error al generar las sugerencias.');
    } finally {
        button.disabled = false;
        if(buttonTextEl) buttonTextEl.textContent = 'Sugerir Ideas';
        if(spinner) spinner.style.display = 'none';
    }
}

async function generateStandardsAndObjectives() {
    collectStepData(1); collectStepData(2);
    const { nombreClase, nivelEducativo, queAprenden } = formData;

    if (!nombreClase || !nivelEducativo || !queAprenden) {
        alert('Por favor, completa la información de los Pasos 1 y 2 antes de solicitar sugerencias.');
        currentStep = !nombreClase || !nivelEducativo ? 1 : 2; updateWizardView(); return;
    }

    const button = sugerirEstandaresButton;
    const buttonTextEl = button.querySelector('.suggester-button-text') as HTMLSpanElement;
    const spinner = button.querySelector('.spinner') as HTMLSpanElement;

    button.disabled = true;
    if(buttonTextEl) buttonTextEl.textContent = 'Generando...';
    if(spinner) spinner.style.display = 'inline-block';

    const systemInstruction = `Eres un asistente experto en el currículo de Tecnología e Informática del Ministerio de Educación Nacional (MEN) de Colombia. Tu tarea es generar estándares de aprendizaje basados ESTRICTAMENTE en las "Orientaciones Generales para la Educación en Tecnología".

El marco curricular se organiza en cuatro componentes principales. Debes identificar el componente más relevante para el tema de la clase y desarrollar los estándares a partir de él:
1.  **Naturaleza y evolución de la tecnología:** Se refiere a la reflexión sobre la tecnología, sus características, historia, y su relación con otras áreas.
2.  **Apropiación y uso de la tecnología:** Implica el desarrollo de habilidades para usar herramientas tecnológicas de manera competente y segura.
3.  **Solución de problemas con tecnología:** Se enfoca en el uso de la tecnología para diseñar, crear y evaluar soluciones a problemas del entorno.
4.  **Tecnología y sociedad:** Analiza las implicaciones éticas, sociales, ambientales y culturales del desarrollo tecnológico.

Basado en la información de la clase proporcionada, sigue estos pasos:
1.  Identifica cuál de los cuatro componentes es el más pertinente.
2.  Formula una competencia específica relacionada con ese componente y adecuada para el grado escolar.
3.  Define al menos dos "Evidencias de Aprendizaje" (también conocidos como desempeños o indicadores de logro) que sean concretos, observables y demuestren el desarrollo de la competencia.

La estructura de tu respuesta DEBE ser la siguiente, y solo debes proporcionar el texto con este formato:
**Componente:** [Nombre del componente seleccionado de la lista anterior]
**Competencia:** [Descripción de la competencia que el estudiante desarrollará]
**Evidencias de Aprendizaje:**
- [Evidencia de aprendizaje concreta y observable 1]
- [Evidencia de aprendizaje concreta y observable 2]
- ... (y así sucesivamente)`;
    const userPrompt = `Genera componentes, competencias y evidencias para una clase de **Grado:** ${nivelEducativo}, **Tema:** ${nombreClase}, con **Objetivos:** ${queAprenden}.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: modelName, contents: userPrompt, config: { systemInstruction: systemInstruction } });
        estandaresObjetivosElement.value = response.text;
        estandaresObjetivosElement.focus();
        estandaresObjetivosElement.classList.add('highlight');
        setTimeout(() => { estandaresObjetivosElement.classList.remove('highlight'); }, 1000);
    } catch (error) {
        console.error('Error suggesting standards:', error);
        alert('Hubo un error al generar las sugerencias.');
    } finally {
        button.disabled = false;
        if(buttonTextEl) buttonTextEl.textContent = 'Sugerir Estándares';
        if(spinner) spinner.style.display = 'none';
    }
}

// --- Rubric Generation Functions ---

function parseMarkdownTable(markdown: string): string {
    const lines = markdown.trim().split('\n').map(line => line.trim()).filter(line => line.startsWith('|'));
    if (lines.length < 2) return `<p class="error-message">La respuesta no es una tabla válida.</p>`;

    let html = '<table>';
    const processCell = (content: string) => escapeHtml(content).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
    html += `<thead><tr>${headers.map(h => `<th>${processCell(h)}</th>`).join('')}</tr></thead>`;
    
    html += '<tbody>';
    lines.slice(2).forEach(line => {
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length === headers.length) {
            html += `<tr>${cells.map(c => `<td>${processCell(c)}</td>`).join('')}</tr>`;
        }
    });
    html += '</tbody></table>';
    return html;
}

function displayGeneratedRubric(rubricHtml: string) {
    if (rubricHtml.includes('error-message')) {
        rubricOutputContainer.innerHTML = rubricHtml;
    } else {
        rubricOutputContainer.innerHTML = rubricHtml;
        currentPlanData.rubricHtml = rubricHtml;
    }
    rubricSectionDetails.style.display = 'block';
}

async function generateRubric(): Promise<string> {
    const systemInstruction = `Crea una rúbrica de evaluación en formato tabla Markdown. Columnas: "Criterio de Evaluación", "Excelente (5)", "Sobresaliente (4)", "Satisfactorio (3)", "En Proceso (2)", "Necesita Mejora (1)". Deriva los criterios de los objetivos. Describe de forma clara y observable cada nivel. Responde ÚNICAMENTE con la tabla.`;
    const userPrompt = `Genera la rúbrica para: **Tema:** ${formData.nombreClase}, **Objetivos:** ${formData.queAprenden}, **Estándares:** ${formData.estandaresObjetivos}.`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: modelName, contents: userPrompt, config: { systemInstruction: systemInstruction } });
        return parseMarkdownTable(response.text);
    } catch (error) {
        console.error('Error in generateRubric API call:', error);
        return '<p class="error-message">Error: No se pudo generar la rúbrica. Por favor, inténtalo de nuevo.</p>';
    }
}

async function handleGenerateRubric() {
    generateRubricButton.disabled = true;
    generateRubricButton.innerHTML = '<span class="spinner"></span> Generando...';
    rubricOutputContainer.innerHTML = `<div class="loading-content"><span class="spinner"></span><p>Generando rúbrica...</p></div>`;
    rubricSectionDetails.style.display = 'block';
    rubricSectionDetails.open = true;
    updateSidebarState();
    try {
        const rubricHtml = await generateRubric();
        displayGeneratedRubric(rubricHtml);
        if (rubricHtml.includes('error-message')) {
            generateRubricButton.disabled = false;
            generateRubricButton.innerHTML = '✨ Reintentar Rúbrica';
        } else {
            generateRubricButton.innerHTML = 'Rúbrica Generada';
        }
    } catch (error) {
        console.error('Error handling rubric generation:', error);
        const errorMessage = '<p class="error-message">Ocurrió un fallo inesperado. Por favor, inténtalo de nuevo.</p>';
        displayGeneratedRubric(errorMessage);
        generateRubricButton.disabled = false;
        generateRubricButton.innerHTML = '✨ Reintentar Rúbrica';
    } finally {
        updateSidebarState();
    }
}

// --- Slides Generation Functions ---

async function generateSlides(): Promise<any> {
    const systemInstruction = `Eres un asistente experto en crear presentaciones educativas. Genera contenido para una serie de diapositivas sobre el tema proporcionado. Para cada diapositiva, crea un título y el contenido en formato HTML simple (usa '<h2>' para el título, '<p>' para párrafos, '<ul>' y '<li>' para listas).

Además, proporciona 4 prompts de imágenes detallados y relevantes para la presentación. Las imágenes deben ser conceptuales o ilustrativas para enriquecer el contenido.

En el HTML de las diapositivas, inserta placeholders [IMAGE_1], [IMAGE_2], [IMAGE_3], y [IMAGE_4] donde consideres que cada imagen generada debería ir. Distribuye las 4 imágenes a lo largo de las diapositivas.

Tu respuesta DEBE ser un objeto JSON que siga el esquema proporcionado.`;
    const userPrompt = `Basado en este plan de clase, genera el contenido para una presentación. **Tema:** ${formData.nombreClase}, **Objetivos:** ${formData.queAprenden}. Analiza el plan para extraer las actividades.`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName, contents: userPrompt,
            config: {
                systemInstruction: systemInstruction, responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        slides: {
                            type: Type.ARRAY,
                            description: "Una lista de diapositivas para la presentación.",
                            items: {
                                type: Type.OBJECT,
                                description: "Una sola diapositiva con un título y contenido HTML.",
                                properties: {
                                    title: {
                                        type: Type.STRING,
                                        description: "El título de la diapositiva."
                                    },
                                    htmlContent: {
                                        type: Type.STRING,
                                        description: "El contenido completo de la diapositiva en formato HTML, que puede incluir placeholders como [IMAGE_1]."
                                    }
                                },
                                required: ["title", "htmlContent"]
                            }
                        },
                        imagePrompts: {
                            type: Type.ARRAY,
                            description: "Una lista de exactamente 4 prompts para generar imágenes.",
                            items: { type: Type.STRING },
                        }
                    },
                    required: ["slides", "imagePrompts"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error('Error in generateSlides API call:', error);
        return { error: 'No se pudo generar el contenido. Por favor, inténtalo de nuevo.' };
    }
}

function renderCurrentSlide() {
    if (!slidesData || slidesData.length === 0) {
        slidesOutputContainer.innerHTML = '';
        return;
    };
    const slide = slidesData[currentSlideIndex];
    const slideHasImage = slide.htmlContent.includes('<img');

    slidesOutputContainer.innerHTML = `
        <div class="slide-viewer">
            <div class="slide ${slideHasImage ? 'has-image' : ''}">${slide.htmlContent}</div>
            <div class="slide-navigation">
                <button id="prev-slide-button" class="slide-nav-button">Anterior</button>
                <span class="slide-counter">${currentSlideIndex + 1} / ${slidesData.length}</span>
                <button id="next-slide-button" class="slide-nav-button">Siguiente</button>
                <button id="expand-slide-button" class="slide-nav-button">Expandir ↗</button>
            </div>
        </div>`;

    (document.getElementById('prev-slide-button') as HTMLButtonElement).disabled = currentSlideIndex === 0;
    (document.getElementById('next-slide-button') as HTMLButtonElement).disabled = currentSlideIndex === slidesData.length - 1;
}

function renderFullscreenSlide() {
    if (!slidesData || slidesData.length === 0) return;
    
    const slide = slidesData[currentSlideIndex];
    const slideHasImage = slide.htmlContent.includes('<img');
    
    fullscreenSlideViewer.innerHTML = `<div class="slide ${slideHasImage ? 'has-image' : ''}">${slide.htmlContent}</div>`;
    fullscreenCounter.textContent = `${currentSlideIndex + 1} / ${slidesData.length}`;
    
    fullscreenPrevBtn.disabled = currentSlideIndex === 0;
    fullscreenNextBtn.disabled = currentSlideIndex === slidesData.length - 1;
}

function openFullscreenSlide() {
    fullscreenSlideModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderFullscreenSlide();
}

function closeFullscreenSlide() {
    fullscreenSlideModal.style.display = 'none';
    document.body.style.overflow = '';
}

function handleSlideNavigation(direction: 'next' | 'prev') {
    if (direction === 'next' && currentSlideIndex < slidesData.length - 1) {
        currentSlideIndex++;
    } else if (direction === 'prev' && currentSlideIndex > 0) {
        currentSlideIndex--;
    }
    renderCurrentSlide();
    if (fullscreenSlideModal.style.display === 'flex') {
        renderFullscreenSlide();
    }
}

function displaySlides(data: any) {
    if (data.error || !data.slides || data.slides.length === 0) {
        slidesOutputContainer.innerHTML = `<p class="error-message">${escapeHtml(data.error || 'No se pudo generar contenido.')}</p>`;
    } else {
        slidesData = data.slides;
        currentPlanData.slidesData = data;
        currentSlideIndex = 0;
        renderCurrentSlide();
    }
    slidesSectionDetails.style.display = 'block';
}

async function handleGenerateSlides() {
    generateSlidesButton.disabled = true;
    generateSlidesButton.innerHTML = '<span class="spinner"></span> Creando...';
    slidesOutputContainer.innerHTML = `<div class="loading-content"><span class="spinner"></span><p>Generando contenido de diapositivas...</p></div>`;
    slidesSectionDetails.style.display = 'block';
    slidesSectionDetails.open = true;
    updateSidebarState();

    try {
        const slideContentData = await generateSlides();

        if (slideContentData.error || !slideContentData.slides || !slideContentData.imagePrompts) {
             throw new Error(slideContentData.error || "La respuesta de la API no fue válida.");
        }

        slidesOutputContainer.innerHTML = `<div class="loading-content"><span class="spinner"></span><p>Generando imágenes para la presentación (1/4)...</p></div>`;
        const imagePrompts = slideContentData.imagePrompts.slice(0, 4);
        const imagePromises = imagePrompts.map((prompt: string, index: number) => {
             slidesOutputContainer.innerHTML = `<div class="loading-content"><span class="spinner"></span><p>Generando imágenes para la presentación (${index + 1}/4)...</p></div>`;
             return ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: `Educational illustration for a presentation slide on "${formData.nombreClase}". Style: clean, simple, colorful. Content: ${prompt}`,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: '16:9',
                },
            });
        });

        const imageResponses = await Promise.all(imagePromises);

        const imageUrls = imageResponses.map((res, index) => {
            if (res.generatedImages?.[0]?.image?.imageBytes) {
                const base64ImageBytes: string = res.generatedImages[0].image.imageBytes;
                return `data:image/png;base64,${base64ImageBytes}`;
            }
            console.warn(`Could not generate image for prompt: ${imagePrompts[index]}`);
            return '';
        });

        const finalSlides = slideContentData.slides.map((slide: { htmlContent: string }) => {
            let finalHtml = slide.htmlContent;
            imageUrls.forEach((url, index) => {
                if (url) {
                    const placeholder = `[IMAGE_${index + 1}]`;
                    const imgTag = `<div class="slide-image-container"><img src="${url}" alt="${escapeHtml(imagePrompts[index])}" class="slide-image"></div>`;
                    finalHtml = finalHtml.replace(new RegExp(`\\${placeholder}`, 'g'), imgTag);
                }
            });
            finalHtml = finalHtml.replace(/\[IMAGE_\d+\]/g, '');
            return { ...slide, htmlContent: finalHtml };
        });

        displaySlides({ slides: finalSlides });
        generateSlidesButton.textContent = 'Diapositivas Creadas';

    } catch (error) {
        console.error('Error handling slides generation:', error);
        let errorMessage = 'Ocurrió un fallo inesperado. Por favor, inténtalo de nuevo.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        displaySlides({ error: errorMessage });
        generateSlidesButton.disabled = false;
        generateSlidesButton.textContent = '🖥️ Reintentar';
    } finally {
        updateSidebarState();
    }
}


// --- Interactive Activities Generation Functions ---

async function generateQuiz(): Promise<any> {
    const systemInstruction = `Crea un cuestionario de 5 preguntas de opción múltiple (A, B, C, D) con una sola respuesta correcta, basado en el tema de la clase. Tu respuesta DEBE ser un objeto JSON con un array 'quiz', cada objeto con 'question', 'options' (objeto A,B,C,D), y 'answer' (letra correcta).`;
    const userPrompt = `Genera un cuestionario para: **Tema:** ${formData.nombreClase}, **Objetivos:** ${formData.queAprenden}.`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName, contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        quiz: {
                            type: Type.ARRAY,
                            description: "Una lista de preguntas para el cuestionario.",
                            items: {
                                type: Type.OBJECT,
                                description: "Una sola pregunta de opción múltiple.",
                                properties: {
                                    question: {
                                        type: Type.STRING,
                                        description: "El texto de la pregunta."
                                    },
                                    options: {
                                        type: Type.OBJECT,
                                        description: "Un objeto que contiene las cuatro opciones de respuesta.",
                                        properties: {
                                            A: { type: Type.STRING, description: "Opción A." },
                                            B: { type: Type.STRING, description: "Opción B." },
                                            C: { type: Type.STRING, description: "Opción C." },
                                            D: { type: Type.STRING, description: "Opción D." }
                                        },
                                        required: ["A", "B", "C", "D"]
                                    },
                                    answer: {
                                        type: Type.STRING,
                                        description: "La letra de la respuesta correcta (A, B, C, o D)."
                                    }
                                },
                                required: ["question", "options", "answer"]
                            }
                        }
                    },
                    required: ["quiz"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error('Error in generateQuiz API call:', error);
        return { error: 'No se pudo generar el cuestionario. Por favor, inténtalo de nuevo.' };
    }
}

function displayQuiz(data: any) {
    if (data.error || !data.quiz || data.quiz.length === 0) {
        interactiveActivitiesContainer.innerHTML += `<div class="activity-card"><p class="error-message">${escapeHtml(data.error || 'No se pudo generar el cuestionario.')}</p></div>`;
        return;
    }
    currentPlanData.quizData = data;
    const quizHtml = data.quiz.map((item: any, index: number) => `
        <div class="question-item">
            <p class="question-text">${index + 1}. ${escapeHtml(item.question)}</p>
            <ul class="options-list">
                <li>A) ${escapeHtml(item.options.A)}</li><li>B) ${escapeHtml(item.options.B)}</li>
                <li>C) ${escapeHtml(item.options.C)}</li><li>D) ${escapeHtml(item.options.D)}</li>
            </ul>
            <button class="answer-reveal-button" data-answer-id="answer-${index}">Mostrar respuesta</button>
            <p class="correct-answer" id="answer-${index}">Respuesta Correcta: <strong>${escapeHtml(item.answer)}</strong></p>
        </div>`).join('');
    interactiveActivitiesContainer.innerHTML += `<div class="activity-card quiz-container"><h3>🧠 Preguntas de Repaso</h3>${quizHtml}</div>`;
    document.querySelectorAll('.answer-reveal-button').forEach(button => {
        button.addEventListener('click', () => {
            const answerEl = document.getElementById(button.getAttribute('data-answer-id')!);
            if (answerEl) { answerEl.style.display = 'block'; (button as HTMLElement).style.display = 'none'; }
        });
    });
}

async function handleGenerateQuiz() {
    generateQuizButton.disabled = true;
    generateQuizButton.innerHTML = '<span class="spinner"></span> Generando...';
    updateSidebarState();
    const loadingId = `loading-quiz-${Date.now()}`;
    interactiveActivitiesSectionDetails.style.display = 'block';
    interactiveActivitiesSectionDetails.open = true;
    interactiveActivitiesContainer.insertAdjacentHTML('beforeend',
        `<div id="${loadingId}" class="activity-card"><div class="loading-content"><span class="spinner"></span><p>Generando preguntas...</p></div></div>`
    );
    try {
        const quizJson = await generateQuiz();
        displayQuiz(quizJson);
        if (quizJson.error) {
            generateQuizButton.disabled = false;
            generateQuizButton.textContent = '🧠 Reintentar';
        } else {
            generateQuizButton.textContent = 'Preguntas Generadas';
        }
    } catch (error) {
        console.error('Error handling quiz generation:', error);
        displayQuiz({ error: 'Ocurrió un fallo inesperado. Por favor, inténtalo de nuevo.' });
        generateQuizButton.disabled = false;
        generateQuizButton.textContent = '🧠 Reintentar';
    } finally {
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();
        updateSidebarState();
    }
}

async function generateWordsearch(): Promise<any> {
    const systemInstruction = `Crea una sopa de letras. Genera de 10 a 12 palabras clave y una cuadrícula de 12x12 que las contenga (horizontal, vertical, diagonal). Rellena los espacios vacíos. Tu respuesta DEBE ser un JSON con 'words' (array de strings) y 'grid' (array de 12 arrays de 12 letras mayúsculas).`;
    const userPrompt = `Genera una sopa de letras para: **Tema:** ${formData.nombreClase}, **Objetivos:** ${formData.queAprenden}.`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName, contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        words: {
                            type: Type.ARRAY,
                            description: "Una lista de 10 a 12 palabras clave para encontrar en la sopa de letras.",
                            items: { type: Type.STRING }
                        },
                        grid: {
                            type: Type.ARRAY,
                            description: "La cuadrícula de 12x12 como un array de arrays, donde cada array interno es una fila de 12 letras.",
                            items: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.STRING,
                                    description: "Una sola letra mayúscula en la cuadrícula."
                                }
                            }
                        }
                    },
                    required: ["words", "grid"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error('Error in generateWordsearch API call:', error);
        return { error: 'No se pudo generar la sopa de letras. Por favor, inténtalo de nuevo.' };
    }
}

function displayWordsearch(data: any) {
    if (data.error || !data.grid || !data.words) {
        interactiveActivitiesContainer.innerHTML += `<div class="activity-card"><p class="error-message">${escapeHtml(data.error || 'No se pudo generar la sopa de letras.')}</p></div>`;
        return;
    }
    currentPlanData.wordsearchData = data;
    const gridHtml = `<table><tbody>${data.grid.map((row: string[]) => `<tr>${row.map((cell: string) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const wordsHtml = `<ul>${data.words.map((word: string) => `<li>${escapeHtml(word)}</li>`).join('')}</ul>`;
    interactiveActivitiesContainer.innerHTML += `
        <div class="activity-card wordsearch-container">
            <h3>🧩 Sopa de Letras</h3>
            <div class="wordsearch-grid">${gridHtml}</div>
            <div class="word-list"><h4>Palabras a encontrar:</h4>${wordsHtml}</div>
        </div>`;
}

async function handleGenerateWordsearch() {
    generateWordsearchButton.disabled = true;
    generateWordsearchButton.innerHTML = '<span class="spinner"></span> Creando...';
    updateSidebarState();
    const loadingId = `loading-wordsearch-${Date.now()}`;
    interactiveActivitiesSectionDetails.style.display = 'block';
    interactiveActivitiesSectionDetails.open = true;
    interactiveActivitiesContainer.insertAdjacentHTML('beforeend',
        `<div id="${loadingId}" class="activity-card"><div class="loading-content"><span class="spinner"></span><p>Creando sopa de letras...</p></div></div>`
    );
    try {
        const wordsearchJson = await generateWordsearch();
        displayWordsearch(wordsearchJson);
        if (wordsearchJson.error) {
            generateWordsearchButton.disabled = false;
            generateWordsearchButton.textContent = '🧩 Reintentar';
        } else {
            generateWordsearchButton.textContent = 'Sopa de Letras Creada';
        }
    } catch (error) {
        console.error('Error handling word search generation:', error);
        displayWordsearch({ error: 'Ocurrió un fallo inesperado. Por favor, inténtalo de nuevo.' });
        generateWordsearchButton.disabled = false;
        generateWordsearchButton.textContent = '🧩 Reintentar';
    } finally {
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();
        updateSidebarState();
    }
}

// --- Firestore Functions ---

async function updateSavedPlansCount() {
    const badge = document.getElementById('saved-plans-count-badge') as HTMLSpanElement;
    if (!badge || !auth.currentUser) return;
    
    try {
      const snapshot = await plansCollection.where('userId', '==', auth.currentUser.uid).get();
      const count = snapshot.size;
      if (count > 0) {
          badge.textContent = String(count);
          badge.style.display = 'flex';
      } else {
          badge.style.display = 'none';
      }
    } catch (error) {
      console.error("Error getting plans count:", error);
      badge.style.display = 'none';
    }
}

async function saveCurrentPlan() {
    const user = auth.currentUser;
    if (!user) {
        alert("Debes iniciar sesión para guardar un plan.");
        return;
    }
    if (!formData.nombreClase) {
        alert("El plan debe tener un nombre para poder guardarlo.");
        return;
    }

    const sidebarLabel = sidebarSavePlanBtn.querySelector('.sidebar-label') as HTMLSpanElement;
    savePlanButton.disabled = true;
    savePlanButton.textContent = 'Guardando...';
    if(sidebarLabel) sidebarLabel.textContent = 'Guardando...';

    const planDataPayload = {
        userId: user.uid,
        title: formData.nombreClase,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        formData: { ...formData },
        planHtml: currentPlanData.planHtml,
        planMarkdown: planMarkdown,
        rubricHtml: currentPlanData.rubricHtml || null,
        slidesData: currentPlanData.slidesData || null,
        quizData: currentPlanData.quizData || null,
        wordsearchData: currentPlanData.wordsearchData || null,
    };

    try {
        if (currentPlanId) {
            // Update existing plan
            await plansCollection.doc(currentPlanId).update(planDataPayload);
        } else {
            // Save new plan
            const docRef = await plansCollection.add(planDataPayload);
            currentPlanId = docRef.id; // Store the ID of the newly saved plan
        }
        
        await updateSavedPlansCount();
        feedbackSectionDetails.style.display = 'block'; // Show feedback now that it's saved

        savePlanButton.textContent = '¡Guardado!';
        if (sidebarLabel) sidebarLabel.textContent = '¡Guardado!';
        setTimeout(() => { 
            savePlanButton.textContent = '💾 Guardar Plan'; 
            if(sidebarLabel) sidebarLabel.textContent = 'Guardar Plan';
        }, 1500);

    } catch (error) {
        console.error("Error saving plan: ", error);
        alert("Hubo un error al guardar el plan.");
        savePlanButton.textContent = '💾 Guardar Plan';
        if (sidebarLabel) sidebarLabel.textContent = 'Guardar Plan';
    } finally {
        savePlanButton.disabled = false;
    }
}


async function deletePlan(planId: string) {
    if (!planId) return;

    try {
        const planDoc = await plansCollection.doc(planId).get();
        if (!planDoc.exists) return;
        const planTitle = planDoc.data()?.title || "este plan";
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'delete-confirmation-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Confirmar Eliminación</h3>
                <p>¿Estás seguro de que quieres eliminar el plan "<strong>${escapeHtml(planTitle)}</strong>"?</p>
                <p>Esta acción no se puede deshacer.</p>
                <div class="modal-actions">
                    <button id="cancel-delete-btn" class="modal-button-secondary">Cancelar</button>
                    <button id="confirm-delete-btn" class="modal-button-primary">Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const confirmBtn = document.getElementById('confirm-delete-btn')! as HTMLButtonElement;
        const cancelBtn = document.getElementById('cancel-delete-btn')! as HTMLButtonElement;
        
        confirmBtn.style.backgroundColor = 'var(--error-color)';
        
        const removeModal = () => document.body.removeChild(modal);
        
        confirmBtn.onclick = async () => {
            await plansCollection.doc(planId).delete();
            await renderSavedPlans();
            await updateSavedPlansCount();
            removeModal();
        };

        cancelBtn.onclick = removeModal;
        modal.onclick = (event) => { if (event.target === modal) removeModal(); };

    } catch (error) {
        console.error("Error preparing to delete plan:", error);
        alert("Hubo un error al intentar eliminar el plan.");
    }
}


async function loadPlan(planId: string) {
    try {
      const doc = await plansCollection.doc(planId).get();
      if (!doc.exists) {
        alert("No se pudo encontrar el plan.");
        return;
      }
      const planToLoad = { id: doc.id, ...doc.data() };
      
      resetButton.click();

      currentPlanId = planToLoad.id;
      Object.assign(formData, planToLoad.formData);
      
      if (planToLoad.planMarkdown) {
          await displayGeneratedPlan(planToLoad.planMarkdown, true);
      } else if (planToLoad.planHtml) {
          planOutputContainer.innerHTML = planToLoad.planHtml;
          navigateTo('output');
      } else {
          await displayGeneratedPlan('<p>Contenido no guardado.</p>', true);
      }

      if (planToLoad.rubricHtml) {
          displayGeneratedRubric(planToLoad.rubricHtml);
          generateRubricButton.innerHTML = 'Rúbrica Generada';
          generateRubricButton.disabled = true;
      }
      if (planToLoad.slidesData) {
          displaySlides(planToLoad.slidesData);
          generateSlidesButton.textContent = 'Diapositivas Creadas';
          generateSlidesButton.disabled = true;
      }
      if (planToLoad.quizData) {
          interactiveActivitiesSectionDetails.style.display = 'block';
          displayQuiz(planToLoad.quizData);
          generateQuizButton.textContent = 'Preguntas Generadas';
          generateQuizButton.disabled = true;
      }
      if (planToLoad.wordsearchData) {
          interactiveActivitiesSectionDetails.style.display = 'block';
          displayWordsearch(planToLoad.wordsearchData);
          generateWordsearchButton.textContent = 'Sopa de Letras Creada';
          generateWordsearchButton.disabled = true;
      }

      await displayFeedback(planId); // Load and display existing feedback
      feedbackSectionDetails.style.display = 'block'; // Show feedback section
      savedPlansModal.style.display = 'none';
      updateSidebarState();

    } catch (error) {
        console.error("Error loading plan:", error);
        alert("Hubo un error al cargar el plan.");
    }
}


async function renderSavedPlans() {
    const user = auth.currentUser;
    if (!user) {
      savedPlansList.innerHTML = '<p class="no-plans-message">Debes iniciar sesión para ver tus planes.</p>';
      return;
    }

    try {
        savedPlansList.innerHTML = `<div class="loading-content"><span class="spinner"></span></div>`;
        const snapshot = await plansCollection.where('userId', '==', user.uid).orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            savedPlansList.innerHTML = '<p class="no-plans-message">Aún no has guardado ningún plan.</p>';
            return;
        }

        const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        savedPlansList.innerHTML = plans.map(plan => `
            <div class="saved-plan-item" data-id="${plan.id}">
                <div class="saved-plan-info">
                    <span class="saved-plan-title">${escapeHtml(plan.title)}</span>
                    <span class="saved-plan-date">Creado: ${plan.createdAt?.toDate().toLocaleDateString('es-CO') || 'N/A'}</span>
                </div>
                <div class="saved-plan-actions">
                    <button class="load-button" title="Cargar Plan">Cargar</button>
                    <button class="delete-button" title="Eliminar Plan">Eliminar</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error fetching saved plans:", error);
        savedPlansList.innerHTML = '<p class="error-message">No se pudieron cargar los planes.</p>';
    }
}


// --- Manual Editing Functions ---

/**
 * Converts an HTML string into a simplified Markdown format compatible with the AI assistant.
 * @param html The HTML string from the contentEditable element.
 * @returns A string in Markdown format.
 */
function htmlToMarkdown(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // First, handle special components like the image generator
    tempDiv.querySelectorAll('.generatable-resource-wrapper').forEach(wrapper => {
        const button = wrapper.querySelector('.generate-image-button') as HTMLButtonElement;
        const prompt = button?.dataset.prompt;
        if (prompt) {
            const markdownTag = `[GENERATE_IMAGE: "${prompt}"]`;
            wrapper.replaceWith(document.createTextNode(markdownTag));
        } else {
             // If image was already generated, keep the original prompt text
            const textContent = wrapper.textContent?.replace(/🎨 Generar Recurso/g, '').trim();
            if (textContent) {
                wrapper.replaceWith(document.createTextNode(textContent));
            }
        }
    });

    let markdown = tempDiv.innerHTML;

    // Process block elements first to ensure proper spacing
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    markdown = markdown.replace(/<p[^>]*>/gi, '\n');
    markdown = markdown.replace(/<h2[^>]*>/gi, '\n\n# ');
    markdown = markdown.replace(/<h3[^>]*>/gi, '\n\n### ');
    markdown = markdown.replace(/<h4[^>]*>/gi, '\n\n'); // h4 content is kept as is
    markdown = markdown.replace(/<li[^>]*>/gi, '\n- ');

    // Process inline elements
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');

    // Strip all remaining HTML tags
    markdown = markdown.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    const decoder = document.createElement('textarea');
    decoder.innerHTML = markdown;
    markdown = decoder.value;

    // Clean up whitespace and newlines
    return markdown.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .replace(/\n\n\n+/g, '\n\n');
}

function toggleEditView(showEditor: boolean) {
    if (showEditor) {
        originalPlanHtml = planOutputContainer.innerHTML;
        planOutputContainer.contentEditable = 'true';
        editorActions.style.display = 'flex';
        planOutputContainer.focus();
    } else {
        planOutputContainer.contentEditable = 'false';
        editorActions.style.display = 'none';
        if (originalPlanHtml && planOutputContainer.innerHTML !== originalPlanHtml) {
            // This case handles cancellation, restore original HTML
            planOutputContainer.innerHTML = originalPlanHtml;
        }
    }
    updateSidebarState();
}


// --- AI Assistant Functions ---

function toggleAIAssistant(show?: boolean) {
    if (show === true) {
        aiAssistantPanel.classList.add('visible');
    } else if (show === false) {
        aiAssistantPanel.classList.remove('visible');
    } else {
        aiAssistantPanel.classList.toggle('visible');
    }
    updateSidebarState();
}

function addMessageToChatUI(text: string, sender: 'user' | 'ai' | 'loading') {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', sender);
    
    if (sender === 'loading') {
        messageEl.innerHTML = `<span class="spinner"></span><span>Pensando...</span>`;
        messageEl.id = 'loading-message';
    } else {
        messageEl.textContent = text;
    }

    aiAssistantMessages.appendChild(messageEl);
    aiAssistantMessages.scrollTop = aiAssistantMessages.scrollHeight;
}

function initializeChat() {
  aiAssistantMessages.innerHTML = ''; // Clear UI

  const systemInstruction = `Eres un asistente experto en la edición de planes de clase para docentes en Colombia. El usuario te proporcionará un plan de clase en formato Markdown y te dará instrucciones para modificarlo. Tu respuesta DEBE SER ÚNICAMENTE el plan de clase completo y actualizado en formato Markdown. No incluyas texto conversacional, saludos, explicaciones adicionales o cualquier otra cosa fuera del plan de clase. Solo el Markdown del plan.`;

  chat = ai.chats.create({
    model: modelName,
    config: { systemInstruction: systemInstruction }
  });

  addMessageToChatUI('¡Hola! Soy tu asistente de IA. Pídeme que refine, acorte, alargue o modifique cualquier parte de tu plan.', 'ai');
}

async function handleSendMessage(event: SubmitEvent) {
    event.preventDefault();
    const userInput = aiAssistantInput.value.trim();
    if (!userInput || !chat) return;

    aiAssistantInput.value = '';
    addMessageToChatUI(userInput, 'user');
    
    addMessageToChatUI('', 'loading');
    aiAssistantSendBtn.disabled = true;
    aiAssistantInput.disabled = true;

    try {
        const promptWithContext = `Este es el plan de clase actual en Markdown:\n\n---\n${planMarkdown}\n---\n\nPor favor, aplica esta instrucción: "${userInput}"`;
        // Fix: Call sendMessage with a SendMessageParameters object
        const response: GenerateContentResponse = await chat.sendMessage({ message: promptWithContext });
        
        const newPlanMarkdown = response.text.trim();
        
        if (newPlanMarkdown.startsWith('#')) {
            await displayGeneratedPlan(newPlanMarkdown, false);
            addMessageToChatUI('¡Listo! He actualizado el plan de clase.', 'ai');
        } else {
             addMessageToChatUI(newPlanMarkdown, 'ai');
        }

    } catch (error) {
        console.error('Error with AI assistant:', error);
        addMessageToChatUI('Lo siento, ocurrió un error al procesar tu solicitud.', 'ai');
    } finally {
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) loadingMsg.remove();
        aiAssistantSendBtn.disabled = false;
        aiAssistantInput.disabled = false;
        aiAssistantInput.focus();
    }
}


// --- Feedback Functions ---
async function displayFeedback(planId: string) {
    feedbackDisplay.style.display = 'none';
    feedbackDisplay.innerHTML = '';
    
    try {
        const feedbackSnapshot = await plansCollection.doc(planId).collection('feedback').orderBy('submittedAt', 'desc').get();
        if (feedbackSnapshot.empty) {
            feedbackForm.style.display = 'block'; // Show form if no feedback yet
            return;
        }
        
        feedbackForm.style.display = 'none'; // Hide form if feedback exists
        const feedbackData = feedbackSnapshot.docs[0].data(); // Assuming one feedback per plan for now
        
        let photosHtml = '';
        if (feedbackData.imageUrls && feedbackData.imageUrls.length > 0) {
            photosHtml = `<div class="submitted-feedback-photos">${feedbackData.imageUrls.map((url: string) => `<img src="${url}" alt="Foto de retroalimentación">`).join('')}</div>`;
        }

        feedbackDisplay.innerHTML = `
            <h4>Retroalimentación Enviada:</h4>
            <div class="submitted-feedback-item">
                <p class="submitted-feedback-text">${escapeHtml(feedbackData.text)}</p>
                ${photosHtml}
            </div>
        `;
        feedbackDisplay.style.display = 'block';

    } catch (error) {
        console.error("Error fetching feedback:", error);
    }
}

async function handleFeedbackSubmit(e: SubmitEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !currentPlanId) return;

    const feedbackText = feedbackTextInput.value.trim();
    const files = feedbackPhotosInput.files;

    if (!feedbackText) {
        alert("Por favor, escribe tus comentarios.");
        return;
    }

    submitFeedbackButton.disabled = true;
    submitFeedbackButton.innerHTML = `<span class="spinner"></span> Enviando...`;
    
    try {
        const imageUrls: string[] = [];
        if (files && files.length > 0) {
            for (const file of Array.from(files)) {
                const filePath = `feedback-images/${currentPlanId}/${Date.now()}-${file.name}`;
                const fileRef = storage.ref(filePath);
                const snapshot = await fileRef.put(file);
                const downloadUrl = await snapshot.ref.getDownloadURL();
                imageUrls.push(downloadUrl);
            }
        }

        await plansCollection.doc(currentPlanId).collection('feedback').add({
            userId: user.uid,
            text: feedbackText,
            imageUrls: imageUrls,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await displayFeedback(currentPlanId); // Refresh feedback display

    } catch (error) {
        console.error("Error submitting feedback:", error);
        alert("Hubo un error al enviar tu retroalimentación.");
    } finally {
        submitFeedbackButton.disabled = false;
        submitFeedbackButton.innerHTML = `Enviar Retroalimentación`;
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            mainAppContainer.style.display = 'flex';
            authContainer.style.display = 'none';
            userSessionInfo.style.display = 'flex';
            userEmailSpan.textContent = user.email;
            updateSavedPlansCount();
            navigateTo('wizard');
        } else {
            // User is signed out.
            mainAppContainer.style.display = 'none';
            authContainer.style.display = 'flex';
            userSessionInfo.style.display = 'none';
            userEmailSpan.textContent = '';
        }
    });
});


// Auth Form Listeners
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    try {
        await auth.signInWithEmailAndPassword(loginEmailInput.value, loginPasswordInput.value);
    } catch (error: any) {
        loginError.textContent = error.message;
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    try {
        await auth.createUserWithEmailAndPassword(signupEmailInput.value, signupPasswordInput.value);
    } catch (error: any) {
        signupError.textContent = error.message;
    }
});

logoutButton.addEventListener('click', () => {
    auth.signOut();
});


sugerirIdeasButton.addEventListener('click', generateLearningObjectiveIdeas);
sugerirEstandaresButton.addEventListener('click', generateStandardsAndObjectives);
generateRubricButton.addEventListener('click', handleGenerateRubric);
generateSlidesButton.addEventListener('click', handleGenerateSlides);
generateQuizButton.addEventListener('click', handleGenerateQuiz);
generateWordsearchButton.addEventListener('click', handleGenerateWordsearch);
savePlanButton.addEventListener('click', saveCurrentPlan);


downloadPdfButton.addEventListener('click', () => {
    downloadModal.style.display = 'flex';
    downloadPlanCheckbox.disabled = !planMarkdown;
    downloadRubricCheckbox.disabled = rubricSectionDetails.style.display === 'none';
    downloadSlidesCheckbox.disabled = slidesSectionDetails.style.display === 'none';
    downloadActivitiesCheckbox.disabled = interactiveActivitiesSectionDetails.style.display === 'none';
    downloadRubricCheckbox.checked = !downloadRubricCheckbox.disabled;
    downloadSlidesCheckbox.checked = !downloadSlidesCheckbox.disabled;
    downloadActivitiesCheckbox.checked = !downloadActivitiesCheckbox.disabled;
});
cancelDownloadButton.addEventListener('click', () => { downloadModal.style.display = 'none'; });
confirmDownloadButton.addEventListener('click', () => { downloadModal.style.display = 'none'; handlePdfGeneration(); });

// Main Navigation Listeners
navInicioButton.addEventListener('click', () => {
    // If a plan is loaded, reset, otherwise just go to wizard
    if (outputSection.style.display === 'block') {
      resetButton.click();
    } else {
      navigateTo('wizard');
    }
});
navMisPlanesButton.addEventListener('click', async () => {
    await renderSavedPlans();
    savedPlansModal.style.display = 'flex';
});
navAyudaButton.addEventListener('click', () => navigateTo('help'));


// Saved Plans Modal Listeners
closeSavedPlansButton.addEventListener('click', () => { savedPlansModal.style.display = 'none'; });
savedPlansList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const planItem = target.closest('.saved-plan-item') as HTMLElement;
    if (!planItem) return;

    const planId = planItem.dataset.id;
    if (planId && target.classList.contains('load-button')) {
        loadPlan(planId);
    } else if (planId && target.classList.contains('delete-button')) {
        deletePlan(planId);
    }
});

// Sidebar Event Listeners
sidebarGeneratePlanBtn.addEventListener('click', () => generateButton.click());
sidebarSavePlanBtn.addEventListener('click', () => savePlanButton.click());
sidebarGenerateRubricBtn.addEventListener('click', () => generateRubricButton.click());
sidebarGenerateSlidesBtn.addEventListener('click', () => generateSlidesButton.click());
sidebarGenerateQuizBtn.addEventListener('click', () => generateQuizButton.click());
sidebarGenerateWordsearchBtn.addEventListener('click', () => generateWordsearchButton.click());
sidebarDownloadPdfBtn.addEventListener('click', () => downloadPdfButton.click());
sidebarResetBtn.addEventListener('click', () => resetButton.click());

// Manual Editing Listeners
sidebarEditPlanBtn.addEventListener('click', () => toggleEditView(true));
cancelEditButton.addEventListener('click', () => {
    planOutputContainer.innerHTML = originalPlanHtml; // Restore original content
    toggleEditView(false);
});
saveEditButton.addEventListener('click', async () => {
    const newHtml = planOutputContainer.innerHTML;
    
    // Extract the new title from the edited HTML to keep it in sync
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newHtml;
    const titleElement = tempDiv.querySelector('.plan-title');
    const newTitle = titleElement ? titleElement.textContent?.trim() : formData.nombreClase;
    
    // Update the in-memory form data with the new title
    if (newTitle) formData.nombreClase = newTitle;

    // Convert edited HTML back to Markdown
    const newMarkdown = htmlToMarkdown(newHtml);
    
    // Re-render the plan from the new markdown to ensure consistency.
    // This also updates global variables like `planMarkdown` and `currentPlanData`.
    await displayGeneratedPlan(newMarkdown, false);
    
    // Save the changes. This will either create a new entry if the plan was never saved,
    // or update the existing entry if it was loaded from storage.
    await saveCurrentPlan();
    
    // Exit edit mode
    toggleEditView(false);

    // Re-initialize the chat so the AI has the latest version
    initializeChat();
});

// AI Assistant Listeners
sidebarAIAssistantBtn.addEventListener('click', () => toggleAIAssistant());
aiAssistantCloseBtn.addEventListener('click', () => toggleAIAssistant(false));
aiAssistantForm.addEventListener('submit', handleSendMessage);

// Slide Navigation Listeners
slidesOutputContainer.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.id === 'prev-slide-button') handleSlideNavigation('prev');
    if (target.id === 'next-slide-button') handleSlideNavigation('next');
    if (target.id === 'expand-slide-button') openFullscreenSlide();
});
fullscreenPrevBtn.addEventListener('click', () => handleSlideNavigation('prev'));
fullscreenNextBtn.addEventListener('click', () => handleSlideNavigation('next'));
closeFullscreenSlideBtn.addEventListener('click', closeFullscreenSlide);
fullscreenSlideModal.addEventListener('click', (e) => {
    if (e.target === fullscreenSlideModal) {
        closeFullscreenSlide();
    }
});
document.addEventListener('keydown', (e) => {
    if (fullscreenSlideModal.style.display !== 'flex') return;
    if (e.key === 'Escape') closeFullscreenSlide();
    if (e.key === 'ArrowRight') handleSlideNavigation('next');
    if (e.key === 'ArrowLeft') handleSlideNavigation('prev');
});

// Feedback Listeners
feedbackForm.addEventListener('submit', handleFeedbackSubmit);
feedbackPhotosInput.addEventListener('change', () => {
    feedbackPhotoPreviews.innerHTML = '';
    if (feedbackPhotosInput.files) {
        for (const file of Array.from(feedbackPhotosInput.files)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.createElement('div');
                preview.className = 'photo-preview';
                preview.innerHTML = `<img src="${e.target?.result}" alt="${file.name}">`;
                feedbackPhotoPreviews.appendChild(preview);
            };
            reader.readAsDataURL(file);
        }
    }
});