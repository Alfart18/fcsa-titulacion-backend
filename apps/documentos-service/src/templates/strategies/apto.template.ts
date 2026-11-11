// Ruta: apps/documentos-service/src/templates/strategies/apto.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildAptoTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    escuela,
    tituloProfesional,
    listaFormateada,
    formatearFechaLargaCastellano,
  } = data;

  const tesistaNom = safe(raw.tesistaNombresSnapshot).toUpperCase();
  const nombreMostrar = tesistaNom ? `**${tesistaNom}**` : listaFormateada;

  const numeroInforme = safe(
    raw.numeroInformeSecretariaSnapshot || raw.informeSecretaria,
  );
  const fechaInformeRaw = safe(
    raw.fechaInformeSecretariaSnapshot || raw.fechaInforme,
  );
  const fechaInformeTexto = fechaInformeRaw
    ? ` de fecha **${formatearFechaLargaCastellano(fechaInformeRaw)}**,`
    : ',';
  const nombreSecretario = safe(
    raw.secretarioAcademicoNombreSnapshot ||
      'el/la Secretario(a) Académico(a) de la Facultad',
  );

  const etiquetaInforme = numeroInforme
    ? `**INFORME ${numeroInforme}**`
    : '**INFORME de Secretaría Académica**';

  return {
    visto: `El ${etiquetaInforme}${fechaInformeTexto} presentado por Secretaría Académica de Facultad dando cuenta de la verificación del expediente de el/la señor(ita) ${nombreMostrar} Bachiller en **${escuela}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
    considerando: [
      `Que, el/la recurrente ha solicitado se organice su expediente conforme al Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco y habiéndose organizado internamente su expediente, es necesario declarar apto para optar al Título Profesional de **${tituloProfesional}.**`,
      `Que, de acuerdo con el Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, establece que el Secretario Académico de la Facultad prosigue con el trámite interno de la validación de la condición del bachiller y cumplimiento de los requisitos de titulación y estando conforme todos los requisitos, ${nombreSecretario}, mediante ${etiquetaInforme} declara apto el expediente y ha puesto a conocimiento del Consejo de Facultad a fin de aprobar el expediente y declarar apto al recurrente para continuar con los trámites correspondientes para optar el Título Profesional.`,
      `Por tanto, el/la Decano(a) de la Facultad de Ciencias de la Salud en calidad de Presidente(a) del Consejo de Facultad en uso de las atribuciones que le confiere el Consejo de Facultad.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**DECLARAR APTO** al Bachiller ${nombreMostrar} para que pueda continuar con el trámite respectivo a fin de optar al Título Profesional de **${tituloProfesional},** en la modalidad de presentación, sustentación y aprobación de tesis, de conformidad con el Reglamento vigente.`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**ENCOMENDAR** a las dependencias universitarias competentes, adoptar las acciones más pertinentes para el cumplimiento de los fines y alcances de la presente Resolución.`,
      },
    ],
  };
}