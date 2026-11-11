// Ruta: apps/documentos-service/src/templates/strategies/asesor.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildAsesorTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    escuela,
    tituloProfesional,
    articuloBachiller,
    listaFormateada,
    esPlural,
    formatearFechaLargaCastellano,
  } = data;

  const asesor = safe(
    raw.asesorNombreCompletoSnapshot || raw.asesor,
  ).toUpperCase();

  const fechaCartaRaw = safe(raw.fechaCartaAceptacion);
  const detalleCarta = fechaCartaRaw
    ? `de fecha **${formatearFechaLargaCastellano(fechaCartaRaw)},**`
    : 'de aceptación';

  const verboSolicitaConsiderando = esPlural ? 'solicitan' : 'solicita';
  const pronombreSolicitaResuelve = esPlural
    ? 'quienes solicitan'
    : 'quien solicita';

  return {
    visto: `La solicitud virtual presentado por ${articuloBachiller} ${listaFormateada}, solicitando nombramiento de asesor(a) de tesis, para optar al Título Profesional de **${tituloProfesional}** de la Universidad Andina del Cusco.`,
    considerando: [
      `Que, la Universidad Andina del Cusco, creada por Ley Nº23837 y autorizado su funcionamiento definitivo por Resolución Nº195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, de acuerdo con el Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela},** ${verboSolicitaConsiderando} el nombramiento de asesor(a) de tesis para optar al Título Profesional de **${tituloProfesional}**.`,
      `Que, en los antecedentes de la documentación tramitada se tiene la carta ${detalleCarta} suscrita por el/la **${asesor},** manifestando su aceptación para el asesoramiento respectivo, por lo que a efectos de su oficialización se requiere del acto administrativo correspondiente.`,
      `Que, el Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones que le confiere la Ley Universitaria N°30220 y el Estatuto Universitario vigente.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**NOMBRAR** al/la **${asesor}**, como **ASESOR(A)** del proyecto y trabajo de investigación (Tesis) de ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela},** ${pronombreSolicitaResuelve} el nombramiento de asesor(a) de tesis para optar al Título Profesional de **${tituloProfesional}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**DETERMINAR** que el/la asesor(a) del proyecto de tesis está obligado a cumplir con las funciones establecidas como indica el literal (o) del Art. 29 del Reglamento General de Docentes y Jefes de Práctica.`,
      },
      {
        titulo: 'TERCERO.-',
        texto: `**SEÑALAR** que el proceso de titulación tiene un solo pago contemplado en el tarifario único de procesos administrativos (TUPA).`,
      },
      {
        titulo: 'CUARTO.-',
        texto: `**ENCARGAR,** el cumplimiento de la presente Resolución a las dependencias académicas correspondientes.`,
      },
    ],
  };
}