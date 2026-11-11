// Ruta: apps/documentos-service/src/templates/strategies/dictamen.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildDictamenTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    tituloProfesional,
    departamentoAcademico,
    articuloBachiller,
    listaFormateada,
    esPlural,
  } = data;

  const titulo = safe(raw.tituloProyecto || raw.tituloVigenteSnapshot);
  const d1 = safe(raw.dictaminante1Snapshot).toUpperCase();
  const d2 = safe(raw.dictaminante2Snapshot).toUpperCase();
  const docentesTexto = [d1, d2].filter(Boolean).join(' y ');
  const recurrenteTexto = esPlural ? 'los(las) recurrentes' : 'el/la recurrente';

  return {
    visto: `La solicitud virtual presentada por ${articuloBachiller} ${listaFormateada}, solicitando dictaminantes para el Proyecto de Tesis Intitulado **"${titulo}",** para optar al Título Profesional de **${tituloProfesional}.**`,
    considerando: [
      `Que, la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, en atención a los documentos de la referencia, el **Departamento Académico de ${departamentoAcademico}** ha procedido a la designación de dos docentes dictaminantes, para la revisión del Proyecto de Tesis presentado por ${recurrenteTexto}, de acuerdo con los requisitos exigidos por el Reglamento Específico de Grados y Títulos de la Facultad de la Universidad Andina del Cusco.`,
      `Que, de acuerdo con el Artículo 73°, de la resolución N° 513 del Reglamento Específico de la Facultad de ciencias de la salud, el decanato emite la resolución de nombramiento a dos docentes dictaminantes propuestos por el **Departamento Académico de ${departamentoAcademico}** quienes emiten el dictamen del proyecto en formato único aprobado por la Universidad, en el plazo máximo de diez (10) días hábiles desde la fecha de recepción, bajo responsabilidad.`,
      `El Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones que le confiere la Ley Universitaria N° 30220 y, el Estatuto vigente de la Universidad Andina del Cusco.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**DESIGNAR** a los señores docentes **${docentesTexto}** como **DICTAMINANTES** del Proyecto de Tesis intitulado: **"${titulo}",** presentado por ${articuloBachiller} ${listaFormateada}, con el propósito de optar al Título Profesional de **${tituloProfesional}** a efectos de que se sirvan emitir Dictamen, conforme estipula el Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud.`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**CONCEDER EL PLAZO PERENTORIO** de acuerdo con el Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud, luego de haber recepcionado la presente Resolución, para que los docentes dictaminantes nombrados, emitan el dictamen correspondiente, bajo responsabilidad.`,
      },
      {
        titulo: 'TERCERO.-',
        texto: `**ENCARGAR**, el cumplimiento de la presente Resolución a las dependencias académicas correspondientes.`,
      },
    ],
  };
}