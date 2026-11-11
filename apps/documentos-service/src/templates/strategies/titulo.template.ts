// Ruta: apps/documentos-service/src/templates/strategies/titulo.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildTituloTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    escuela,
    tituloProfesional,
    articuloBachiller,
    listaFormateada,
    formatearFechaLargaCastellano,
  } = data;

  const tesistaNom = safe(raw.tesistaNombresSnapshot).toUpperCase();
  const nombreMostrar = tesistaNom ? `**${tesistaNom}**` : listaFormateada;

  const numeroInforme = safe(
    raw.numeroInformeSecretariaSnapshot || raw.informeSecretaria,
  );
  const etiquetaInforme = numeroInforme
    ? `**INFORME ${numeroInforme}**`
    : '**INFORME de Secretaría Académica**';

  const nombreSecretario = safe(
    raw.secretarioAcademicoNombreSnapshot ||
      'el/la Secretario(a) Académico(a) de la Facultad',
  );

  const fechaSustRaw = safe(raw.fechaSustentacionReal);
  const fechaSustTexto = fechaSustRaw
    ? formatearFechaLargaCastellano(fechaSustRaw)
    : '';

  const resultadoSustentacion = safe(
    raw.resultadoSustentacion || 'APROBADO',
  ).toUpperCase();
  const nota = safe(raw.notaSustentacion);
  const notaLiteral = safe(raw.notaSustentacionLiteral).toUpperCase();
  const textoNota = notaLiteral
    ? `**${notaLiteral} (${nota})**`
    : `**(${nota})**`;

  return {
    visto: `La solicitud virtual presentado por ${articuloBachiller} ${nombreMostrar} Bachiller en **${escuela}** de la Universidad Andina del Cusco.`,
    considerando: [
      `Que, de acuerdo con lo establecido por la Ley Nº 30220 y el Estatuto de la Universidad Andina, sobre el otorgamiento de Grados Académicos y Títulos Profesionales; compete al Consejo de Facultad aprobar el expediente del Título Profesional de **${tituloProfesional}**, que haya cumplido con los requisitos establecidos en el Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
      `Que, de conformidad al Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, establece que el Secretario Académico de la Facultad prosigue con el trámite interno de validación de la condición del bachiller y cumplimiento de los requisitos de titulación y, estando conforme todos los requisitos ${nombreSecretario} mediante ${etiquetaInforme} emite la conformidad del expediente y ha puesto a conocimiento del Consejo de Facultad de la Facultad de Ciencias de la Salud.`,
      `Que, el/la recurrente ha elegido la modalidad de presentación, sustentación y aprobación de tesis, para optar al Título Profesional de **${tituloProfesional}** que en fecha **${fechaSustTexto},** ha sustentado el trabajo de investigación propuesto ante el jurado designado al respecto, obteniendo el calificativo de **${resultadoSustentacion}** con nota de: ${textoNota} puntos.`,
      `Que, con la finalidad de dar trámite al expediente organizado por el interesado, se aprueba el expediente del Título Profesional de **${tituloProfesional},** elevando al Vicerrectorado Académico para su verificación, aprobación y otorgamiento del diploma por el Consejo Universitario.`,
      `Por tanto, el/la Decano(a) de la Facultad de Ciencias de la Salud en calidad de Presidente(a) del Consejo de Facultad en uso de las atribuciones que le confiere el Consejo de Facultad.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**APROBAR** el expediente administrativo para optar al Título Profesional de **${tituloProfesional}** de el/la Bachiller ${nombreMostrar} por haber cumplido con el procedimiento y requisitos exigidos por el Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco y en mérito a los considerandos que sustentan la presente Resolución.`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**ELEVAR** el expediente administrativo al Vice Rectorado Académico a fin de que se dé cuenta al Consejo Universitario para que de acuerdo al reglamento vigente confiera el título profesional correspondiente.`,
      },
    ],
  };
}