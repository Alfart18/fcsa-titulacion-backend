// Ruta: apps/documentos-service/src/templates/strategies/cambio-asesor.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildCambioAsesorTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    escuela,
    articuloBachiller,
    listaFormateada,
    esPlural,
    formatearFechaLargaCastellano,
  } = data;

  const antNum = safe(raw.resolucionAntecedenteNumeroSnapshot);
  const fechaAntRaw = safe(
    raw.fechaResolucionAntecedenteSnapshot || raw.fechaResolucionAntecedente,
  );
  const fechaAntTexto = fechaAntRaw
    ? `, de fecha ${formatearFechaLargaCastellano(fechaAntRaw)}`
    : '';

  const saliente = safe(raw.asesorSalienteSnapshot).toUpperCase();
  const entrante = safe(raw.asesorNombreCompletoSnapshot).toUpperCase();
  const causa = safe(
    raw.causaTextoConsolidadoSnapshot || 'por cese de vínculo laboral',
  );

  const recurrentesTexto = esPlural
    ? 'los recurrentes solicitan'
    : 'el/la recurrente solicita';
  const verboPropone = esPlural ? 'proponen' : 'propone';

  return {
    visto: `La solicitud virtual presentado por ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela}** solicitando cambio de asesor(a) del proyecto y trabajo de Investigación.`,
    considerando: [
      `Que la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, mediante **RESOLUCIÓN N° ${antNum}${fechaAntTexto},** se designó a el/la **${saliente},** como asesor(a) del proyecto y Trabajo de investigación (TESIS) de ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, a propuesta de la interesada(o).`,
      `Que, de conformidad al presente Reglamento, el estudiante o Bachiller tienen derecho a proponer el nombre del docente asesor o asesores, debiendo ser preferentemente un docente ordinario o contratado con especialidad en el tema de la investigación, pudiendo solicitar su cambio por una sola vez por causas justificadas y con conocimiento del asesor nombrado previamente.`,
      `Que, a través del documento del visto, ${recurrentesTexto} el cambio del docente asesor(a): **${saliente}, ${causa}**, para lo cual ${verboPropone} a el/la **${entrante},** como nuev(a) asesor(a) del trabajo de investigación, adjuntando para ello la carta de aceptación correspondiente.`,
      `En consecuencia, en uso de las atribuciones que le confiere la Ley Universitaria vigente y el Estatuto de la Universidad Andina del Cusco.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**DEJAR SIN EFECTO** la **RESOLUCIÓN N° ${antNum}${fechaAntTexto}** en mérito a los fundamentos expuestos de la presente resolución.`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**NOMBRAR** a el/la **${entrante},** como **ASESOR(A)** del proyecto y trabajo de investigación (Tesis) de ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
      },
      {
        titulo: 'TERCERO.-',
        texto: `**ENCARGAR**, el cumplimiento de la presente Resolución a las dependencias académicas correspondientes.`,
      },
    ],
  };
}