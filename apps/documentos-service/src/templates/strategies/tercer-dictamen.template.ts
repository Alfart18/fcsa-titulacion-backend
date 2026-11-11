// Ruta: apps/documentos-service/src/templates/strategies/tercer-dictamen.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildTercerDictamenTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    tituloProfesional,
    departamentoAcademico,
    listaFormateada,
    esPlural,
  } = data;

  const titulo = safe(raw.tituloVigenteSnapshot || raw.tituloProyecto);
  const d1 = safe(raw.dictaminante1Snapshot).toUpperCase();
  const d2 = safe(raw.dictaminante2Snapshot).toUpperCase();
  const d3 = safe(raw.dictaminante3Snapshot).toUpperCase();
  const tratoBachiller = esPlural ? 'los(las) bachilleres' : 'el/la bachiller';
  const recurrenteTexto = esPlural ? 'los(las) recurrentes' : 'la recurrente';

  const listaDictaminantesPrevios = [d1, d2]
    .filter(Boolean)
    .map((d) => `**${d}.**`)
    .join(' ');

  return {
    visto: `La solicitud virtual presentada por ${tratoBachiller} ${listaFormateada}, solicitando tercer dictaminante para la Tesis Intitulada **"${titulo}",** para optar al Título Profesional de **${tituloProfesional}**.`,
    considerando: [
      `Que, la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, en mérito a los documentos que obran en el expediente, el Departamento Académico de **${departamentoAcademico}** ha procedido a la designación de dos docentes dictaminantes para la evaluación de la tesis presentada por ${recurrenteTexto}, verificando previamente el cumplimiento de los requisitos establecidos en el Reglamento Marco de Grados y Títulos de la Universidad Andina del Cusco.`,
      `Que, de conformidad con lo dispuesto en el Reglamento Específico de la Facultad de Ciencias de la Salud y en el artículo 92° del Reglamento Marco de Grados y Títulos, corresponde la designación de un tercer dictaminante para complementar el proceso de evaluación académica de la tesis, garantizando la objetividad y rigurosidad del procedimiento de dictamen.`,
      `Que, asimismo, de acuerdo con lo establecido en el artículo 99° del Reglamento Específico de Grados y Títulos, los docentes dictaminantes designados deberán emitir el dictamen correspondiente, dentro del plazo máximo de quince (15) días hábiles contados a partir de la recepción de la documentación respectiva, bajo responsabilidad.`,
      `Que, la evaluación de los trabajos de investigación constituye una etapa esencial para la obtención del título profesional, siendo responsabilidad de los docentes dictaminantes emitir una opinión técnica y académica debidamente fundamentada, en observancia de la normativa institucional vigente.`,
      `Que el Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones que le confiere la Ley Universitaria N° 30220 y, el Estatuto vigente de la Universidad Andina del Cusco.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**DESIGNAR COMO DICTAMINANTES** de la tesis intitulada: "${titulo}", presentado por ${tratoBachiller} ${listaFormateada}, los docentes: ${listaDictaminantesPrevios}`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**DESIGNAR** como **TERCER DICTAMINANTE** al/a la **${d3},** de la Tesis intitulada **"${titulo}"** presentado por ${tratoBachiller} ${listaFormateada}, con el propósito de optar al Título Profesional de **${tituloProfesional}** a efectos de que se sirvan emitir Dictamen, conforme estipula el Reglamento Marco de la Universidad Andina del Cusco.`,
      },
      {
        titulo: 'TERCERO.-',
        texto: `**CONCEDER EL PLAZO PERENTORIO** de acuerdo con el Reglamento Marco de la Universidad Andina del Cusco, luego de haber recepcionado la presente Resolución, para que los docentes dictaminantes nombrados, emitan el dictamen correspondiente, bajo responsabilidad.`,
      },
    ],
  };
}