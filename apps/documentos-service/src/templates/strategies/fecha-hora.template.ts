// Ruta: apps/documentos-service/src/templates/strategies/fecha-hora.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildFechaHoraTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    tituloProfesional,
    reglamentoMarco,
    listaFormateada,
    esPlural,
  } = data;

  const titulo = safe(raw.tituloVigenteSnapshot || raw.tituloProyecto);
  const fechaSust = safe(raw.fechaSustentacion).toUpperCase();
  const horaSust = safe(raw.horaSustentacion).toUpperCase();
  const modalidad = safe(raw.modalidad || 'presencial').toLowerCase();
  const lugar = safe(raw.lugarReferencia);

  const jurado =
    typeof raw.juradoSnapshot === 'object' && raw.juradoSnapshot !== null
      ? raw.juradoSnapshot
      : {};

  const presidente = safe(jurado.presidente).toUpperCase();
  const primerMiembro = safe(
    jurado.primerMiembro || jurado.secretario || jurado.dictaminante1,
  ).toUpperCase();
  const segundoMiembro = safe(
    jurado.segundoMiembro || jurado.dictaminante || jurado.dictaminante2,
  ).toUpperCase();
  const asesor = safe(
    raw.asesorNombreCompletoSnapshot || jurado.asesor,
  ).toUpperCase();

  const dictaminantesConsiderando = [presidente, primerMiembro, segundoMiembro]
    .filter(Boolean)
    .join(', ');

  const tratoBachiller = esPlural ? 'los(las) bachilleres' : 'el/la bachiller';
  const lugarTexto = lugar ? ` (${lugar})` : '';

  const lineasJurado = [
    presidente ? `**${presidente}** - **Presidente**` : '',
    primerMiembro ? `**${primerMiembro}** - **Secretario(a)**` : '',
    segundoMiembro ? `**${segundoMiembro}** - **Dictaminante**` : '',
    asesor ? `**${asesor}** - **Asesor**` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    visto: `La solicitud virtual presentada por ${tratoBachiller} ${listaFormateada}, solicitando designación de jurado, fecha y hora para la sustentación de la Tesis Intitulada "**${titulo}**" para optar al Título Profesional de **${tituloProfesional}**.`,
    considerando: [
      `Que, la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, de acuerdo al Artículo 119° del Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, aprobado con ${reglamentoMarco}, la sustentación es un acto público, debe estar dirigida al jurado, puede ser realizada de forma presencial o virtual, la presencialidad o virtualidad la determinará el Decano de la Facultad en coordinación con el Director de Departamento Académico al que pertenecen los docentes del jurado.`,
      `Que, en atención a la petición de los documentos del visto, se procedió a la designación correspondiente para conformar el Jurado Evaluador de la Sustentación de Tesis presentado por el/la recurrente en estricto cumplimiento al Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, cuyo jurado está conformado de acuerdo al detalle que se indica en la parte resolutiva de la presente resolución.`,
      `Que, estando los dictámenes favorables emitidos por los docentes **${dictaminantesConsiderando}** y Borrador de Tesis formulado por el/la recurrente, en armonía al Reglamento respectivo de la Universidad Andina del Cusco y las Directivas vigentes, es procedente conformar el Jurado Evaluador y fijar fecha y hora de sustentación de tesis a que se hace referencia en el Visto.`,
      `El Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones que le confiere la Ley Universitaria vigente y, el Estatuto de la Universidad Andina del Cusco.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**NOMBRAR**, al Jurado examinador para el acto de sustentación y defensa de la tesis Titulada "**${titulo}"** presentado por ${tratoBachiller} ${listaFormateada}, para optar al Título Profesional de **${tituloProfesional}**, conformado en la forma siguiente:\n${lineasJurado}`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**FIJAR FECHA Y HORA** para la Sustentación de Tesis, el día **${fechaSust} A LAS ${horaSust} HORAS,** en la modalidad ${modalidad}${lugarTexto}, acto en el que los señores miembros del jurado deberán asistir con la formalidad del acto académico.`,
      },
      {
        titulo: 'TERCERO.-',
        texto: `**ENCOMENDAR** a las dependencias que corresponda adoptar las medidas convenientes para el cumplimiento de la presente Resolución.`,
      },
    ],
  };
}