// Ruta: apps/documentos-service/src/templates/strategies/cambio-titulo.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildCambioTituloTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    tituloProfesional,
    articuloBachiller,
    listaFormateada,
    formatearFechaLargaCastellano,
  } = data;

  const antNum = safe(raw.resolucionAntecedenteNumeroSnapshot);
  const fechaAntRaw = safe(
    raw.fechaResolucionAntecedenteSnapshot || raw.fechaResolucionAntecedente,
  );
  const fechaAntTexto = fechaAntRaw
    ? `, de fecha ${formatearFechaLargaCastellano(fechaAntRaw)}`
    : '';

  const dice = safe(raw.diceTituloAnterior);
  const debeDecir = safe(raw.debeDecirNuevoTitulo);

  return {
    visto: `La solicitud virtual presentado por ${articuloBachiller} ${listaFormateada}, solicitando el cambio del título de la tesis intitulada inicialmente como: **"${dice}",** para optar al Título profesional de **${tituloProfesional}.**`,
    considerando: [
      `Que, la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, mediante la **RESOLUCIÓN N° ${antNum}${fechaAntTexto}**, el Decano de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, dispuso designar dictaminantes del proyecto de investigación referido líneas arriba, sin embargo en el proceso de la revisión del proyecto de tesis se ha visto de que el título del proyecto debe ajustarse al trabajo de investigación; por lo que, los dictaminantes y el asesor(a) han sugerido la modificación del título del proyecto a fin de viabilizar dicho trabajo para efectos de la emisión del dictamen favorable y estando ajustado a la normatividad vigente, corresponde emitir la correspondiente Resolución que oficialice acto administrativo.`,
      `Que, estando a lo solicitado, el Decano de la Facultad de Ciencias de la Salud, en uso de sus atribuciones que le confiere la Ley Universitaria Nº 30220 y el Estatuto vigente Universitario.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**MODIFICAR** el título del proyecto de tesis, presentado por ${articuloBachiller} ${listaFormateada}, para efecto de continuar su trámite y optar al Título Profesional de **${tituloProfesional}**, de acuerdo con el detalle siguiente:\n**DICE:**\n**"${dice}"**\n**DEBE DECIR:**\n**"${debeDecir}".**`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**ENCARGAR**, a las dependencias que corresponda, adoptar las medidas complementarias más convenientes, para el cumplimiento de la presente Resolución.`,
      },
    ],
  };
}