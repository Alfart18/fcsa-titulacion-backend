// Ruta: apps/documentos-service/src/templates/strategies/cambio-dictaminante.template.ts
import {
  CambioDictaminanteData,
  ResolucionTipoCambio,
  SeccionesJuridicasResult,
  VarianteSegundoTipoA,
} from '../interfaces/template.interface';

const safe = (val?: unknown, fallback = ''): string =>
  val !== undefined && val !== null && String(val).trim() !== ''
    ? String(val).trim()
    : fallback;

function formatResolucionesAnterioresConsiderando(
  data: CambioDictaminanteData,
): string {
  const lista = Array.isArray(data.resolucionesAnteriores)
    ? data.resolucionesAnteriores
    : [];

  if (lista.length >= 2) {
    return lista
      .slice(0, 2)
      .map(
        (r) =>
          `**RESOLUCIÓN Nº ${safe(r.numeroResAnterior)} - ${safe(r.anioResAnterior)} - FCSa - UAC,** de fecha ${safe(r.fechaResAnteriorLiteral)}`,
      )
      .join(' y ');
  }

  if (lista.length === 1) {
    const r = lista[0];
    return `**RESOLUCIÓN Nº ${safe(r.numeroResAnterior)} - ${safe(r.anioResAnterior)} - FCSa - UAC,** de fecha ${safe(r.fechaResAnteriorLiteral)}`;
  }

  return `**RESOLUCIÓN Nº ${safe(data.numeroResAnterior)} - ${safe(data.anioResAnterior)} - FCSa - UAC,** de fecha ${safe(data.fechaResAnteriorLiteral)}`;
}

function getPrimeraResolucionAnterior(data: CambioDictaminanteData): {
  num: string;
  anio: string;
  fecha: string;
} {
  const primera =
    Array.isArray(data.resolucionesAnteriores) &&
    data.resolucionesAnteriores.length > 0
      ? data.resolucionesAnteriores[0]
      : null;

  return {
    num: safe(primera?.numeroResAnterior ?? data.numeroResAnterior),
    anio: safe(primera?.anioResAnterior ?? data.anioResAnterior),
    fecha: safe(
      primera?.fechaResAnteriorLiteral ?? data.fechaResAnteriorLiteral,
    ),
  };
}

export function buildCambioDictaminanteTemplate(
  data: CambioDictaminanteData,
): SeccionesJuridicasResult {
  const tipoCambio = data.tipoCambio ?? ResolucionTipoCambio.TIPO_A;
  const tratamiento = safe(data.tratamiento || data.articuloBachiller);
  const estudianteNombres = safe(
    data.estudianteNombres || data.listaNombresPlanos,
  );
  const tesisTitulo = safe(data.tesisTitulo);
  const tituloProfesional = safe(data.tituloProfesional);
  const escuela = safe(data.escuela);
  const departamentoAcademico = safe(data.departamentoAcademico);

  const docentesOriginales = safe(data.docentesOriginales);
  const docenteSaliente = safe(data.docenteSaliente);
  const docenteEntrante = safe(data.docenteEntrante);
  const motivoLiteral = safe(data.motivoLiteral);

  const docenteTerceroSaliente = safe(
    data.docenteTerceroSaliente || data.docenteSaliente,
  );
  const docenteTerceroEntrante = safe(
    data.docenteTerceroEntrante || data.docenteEntrante,
  );

  const a_o = safe(data.concordancia?.a_o, 'a');
  const el_la_los_las = safe(
    data.concordancia?.el_la_los_las,
    data.esPlural ? 'los(las)' : 'el/la',
  );
  const s = safe(data.concordancia?.s, data.esPlural ? 's' : '');
  const o_a = safe(data.concordancia?.o_a, 'o(a)');
  const el_la_las_los = safe(
    data.concordancia?.el_la_las_los,
    data.esPlural ? 'los(las)' : 'el/la',
  );
  const a_o_as_os = safe(
    data.concordancia?.a_o_as_os,
    data.esPlural ? 'os(as)' : 'o(a)',
  );

  const resAnteriorConsiderando =
    formatResolucionesAnterioresConsiderando(data);
  const { num, anio, fecha } = getPrimeraResolucionAnterior(data);

  const parrafoMarcoLegalBC = `Que, la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`;

  const cierreAtribuciones = `Que, el Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones que le confiere la Ley Universitaria N° 30220 y, el Estatuto vigente de la Universidad Andina del Cusco.`;

  const resuelveTerceroPlazoPerentorioBC = `**CONCEDER EL PLAZO PERENTORIO** de acuerdo con el Reglamento Marco de la Universidad Andina del Cusco, luego de haber recepcionado la presente Resolución, para que los docentes dictaminantes nombrados, emitan el dictamen correspondiente, bajo responsabilidad.`;

  const buildPrimeroTipoAyB = (): string => {
    const reemplazos = Array.isArray(data.reemplazos) ? data.reemplazos : [];

    if (reemplazos.length >= 2) {
      const saliente1 = safe(reemplazos[0]?.saliente);
      const saliente2 = safe(reemplazos[1]?.saliente);
      const entrante1 = safe(reemplazos[0]?.entrante);
      const entrante2 = safe(reemplazos[1]?.entrante);

      return `**MODIFICAR** en **parte** la **RESOLUCIÓN Nº ${num} - ${anio} - FCSa - UAC,** de fecha ${fecha}, que designa a los docentes Dictaminantes de la Tesis: "${tesisTitulo}", formulado por ${tratamiento} **${estudianteNombres}**, de la Escuela Profesional de **${escuela}**; **REEMPLAZANDO** a los Dictaminantes **${saliente1} y ${saliente2}**, con el/la **${entrante1} y ${entrante2}**, en mérito a los considerandos que sustentan la presente Resolución.`;
    }

    const salienteUnico = safe(reemplazos[0]?.saliente || docenteSaliente);
    const entranteUnico = safe(reemplazos[0]?.entrante || docenteEntrante);

    return `**MODIFICAR** en **parte** la **RESOLUCIÓN Nº ${num} - ${anio} - FCSa - UAC,** de fecha ${fecha}, que designa a los docentes Dictaminantes de la Tesis: "${tesisTitulo}", formulado por ${tratamiento} **${estudianteNombres}**, de la Escuela Profesional de **${escuela}**; **REEMPLAZANDO** al/a la Dictaminante **${salienteUnico}**, con el/la **${entranteUnico}**, en mérito a los considerandos que sustentan la presente Resolución.`;
  };

  switch (tipoCambio) {
    case ResolucionTipoCambio.TIPO_B: {
      const visto = `La solicitud virtual presentada por el/la bachiller **${estudianteNombres}**, solicitando tercer dictaminante para la Tesis Intitulada "${tesisTitulo}", para optar al Título Profesional de **${tituloProfesional}**.`;

      const considerando: string[] = [
        parrafoMarcoLegalBC,
        `Que, en mérito a los documentos que obran en el expediente, el Departamento Académico de **${departamentoAcademico}** ha procedido a la designación de dos docentes dictaminantes para la evaluación de la tesis presentada por la recurrente, verificando previamente el cumplimiento de los requisitos establecidos en el Reglamento Marco de Grados y Títulos de la Universidad Andina del Cusco.`,
        `Que, de conformidad con lo dispuesto en el Reglamento Específico de la Facultad de Ciencias de la Salud y en el artículo 92° del Reglamento Marco de Grados y Títulos, corresponde la designación de un tercer dictaminante para complementar el proceso de evaluación académica de la tesis, garantizando la objetividad y rigurosidad del procedimiento de dictamen.`,
        `Que, asimismo, de acuerdo con lo establecido en el artículo 99° del Reglamento Específico de Grados y Títulos, los docentes dictaminantes designados deberán emitir el dictamen correspondiente, dentro del plazo máximo de quince (15) días hábiles contados a partir de la recepción de la documentación respectiva, bajo responsabilidad.`,
        `Que, mediante ${resAnteriorConsiderando}, se designó a el/la **${docentesOriginales}**, docentes del **Departamento Académico de ${departamentoAcademico}**, como dictaminantes del proyecto de Tesis presentad${a_o} por ${el_la_los_las} recurrente${s}. Que, en atención a los documentos de la referencia, el **Departamento Académico de ${departamentoAcademico}**, llevó a cabo la reunión donde el/la recurrente solicita el cambio de el/la **${docenteSaliente}**, **${motivoLiteral}**, por lo que, se ha procedido a la designación de nuevo docente Dictaminante, recayendo en el/la **${docenteEntrante}**, docente del **Departamento Académico de ${departamentoAcademico}**, como nuev${o_a} Dictaminante de la tesis presentad${a_o} por ${el_la_las_los} administrad${a_o_as_os}.`,
        cierreAtribuciones,
      ];

      const tercerDictaminanteDesignado = safe(
        data.tercerDictaminanteDesignado || docenteEntrante,
      );

      return {
        visto,
        considerando,
        articulosResolutivos: [
          {
            titulo: 'PRIMERO.-',
            texto: buildPrimeroTipoAyB(),
          },
          {
            titulo: 'SEGUNDO.-',
            texto: `**DESIGNAR** como **TERCER DICTAMINANTE** al/a la **${tercerDictaminanteDesignado}** de la Tesis intitulada "${tesisTitulo}" presentado por el/la bachiller **${estudianteNombres}**, con el propósito de optar al Título Profesional de **${tituloProfesional}** a efectos de que se sirvan emitir Dictamen, conforme estipula el Reglamento Marco de la Universidad Andina del Cusco.`,
          },
          {
            titulo: 'TERCERO.-',
            texto: resuelveTerceroPlazoPerentorioBC,
          },
        ],
      };
    }

    case ResolucionTipoCambio.TIPO_C: {
      const visto = `La solicitud virtual presentada por el/la bachiller **${estudianteNombres}**, solicitando cambio del Tercer Dictaminante para la Tesis Intitulada "${tesisTitulo}", para optar al Título Profesional de **${tituloProfesional}**.`;

      const consideringC: string[] = [
        parrafoMarcoLegalBC,
        `Que, en atención a los documentos de la referencia, el Departamento Académico de **${departamentoAcademico}** ha procedido a la designación de dos docentes dictaminantes, para la revisión del Proyecto de Tesis presentad${a_o} por el/la recurrente, de acuerdo con los requisitos exigidos por el Reglamento Marco De Grados Y Títulos de la Universidad Andina Del Cusco.`,
        `Que, estando a lo establecido en el Reglamento Específico de la Facultad de Ciencias de la Salud, el decanato emite la resolución de nombramiento a dos docentes dictaminantes del **Departamento Académico de ${departamentoAcademico}** y un Tercer Dictaminante según el Art. 42 de la Resolución N°513 emiten el dictamen en formato único aprobado por la Universidad, en el plazo máximo de quince (15) días hábiles desde la fecha de recepción, bajo responsabilidad.`,
        `Que, mediante ${resAnteriorConsiderando}, se designó a el/la **${docenteTerceroSaliente}**, docente del Departamento Académico de ${departamentoAcademico}, como Tercer Dictaminante de la Tesis presentad${a_o} por ${el_la_los_las} recurrente${s}.`,
        `Que, en atención a los documentos de la referencia, el **Departamento Académico de ${departamentoAcademico}**, llevó a cabo la reunión donde el/la recurrente solicita el cambio de el/la **${docenteTerceroSaliente}**, **${motivoLiteral};** por lo que, se ha procedido a la designación de un nuevo docente como Tercer Dictaminante, recayendo en el/la **${docenteTerceroEntrante}**, docente del **Departamento Académico de ${departamentoAcademico}**, como nuev${o_a} Tercer Dictaminante de la tesis presentad${a_o} por ${el_la_las_los} administrad${a_o_as_os}.`,
        cierreAtribuciones,
      ];

      const ratificado0 = safe(data.docentesRatificados?.[0]);
      const ratificado1 = safe(data.docentesRatificados?.[1]);

      return {
        visto,
        considerando: consideringC,
        articulosResolutivos: [
          {
            titulo: 'PRIMERO.-',
            texto: `**MODIFICAR** en **parte** la **RESOLUCIÓN N° ${num} - ${anio} - FCSa - UAC,** de fecha ${fecha}, únicamente en el extremo referido a la designación del **Tercer Dictaminante** de la Tesis intitulada: "${tesisTitulo}", formulada por el/la señor(ita) **${estudianteNombres}**, de la Escuela Profesional de **${escuela}**; **REEMPLAZANDO** al Tercer Dictaminante **${docenteTerceroSaliente}**, con el/la **${docenteTerceroEntrante}**, quien asumirá la función de **Tercer Dictaminante** de la referida tesis, en mérito a los considerandos que sustentan la presente Resolución.`,
          },
          {
            titulo: 'SEGUNDO.-',
            texto: `**DESIGNAR COMO DICTAMINANTES** de la tesis intitulada: "${tesisTitulo}", presentado por el/la bachiller **${estudianteNombres}**, los docentes: **${ratificado0}**. **${ratificado1}**.`,
          },
          {
            titulo: 'TERCERO.-',
            texto: resuelveTerceroPlazoPerentorioBC,
          },
        ],
      };
    }

    case ResolucionTipoCambio.TIPO_A:
    default: {
      const visto = `La solicitud virtual presentada por ${tratamiento} **${estudianteNombres}**, solicitando cambio de dictaminantes para la tesis Intitulada "${tesisTitulo}", para optar al Título Profesional de **${tituloProfesional}**.`;

      const considerando: string[] = [
        `Que, la Universidad Andina del Cusco es una institución de educación superior universitaria regida por la Ley Universitaria N.° 30220, su Estatuto, reglamentos internos y demás disposiciones que regulan el desarrollo de las actividades académicas y de investigación.`,
        `Que, mediante ${resAnteriorConsiderando}, se designó a el/la **${docentesOriginales}**, docentes del **Departamento Académico de ${departamentoAcademico}**, como dictaminantes del proyecto de Tesis presentad${a_o} por ${el_la_los_las} recurrente${s}.`,
        `Que, en atención a los documentos de la referencia, el **Departamento Académico de ${departamentoAcademico}**, llevó a cabo la reunión donde el/la recurrente solicita el cambio de el/la **${docenteSaliente}**, **${motivoLiteral};** por lo que, se ha procedido a la designación de nuev${o_a} docente Dictaminante, recayendo en el/la **${docenteEntrante}**, docente del **Departamento Académico de ${departamentoAcademico}**, como nuev${o_a} Dictaminante de la tesis presentad${a_o} por ${el_la_las_los} administrad${a_o_as_os}.`,
        cierreAtribuciones,
      ];

      const docenteQuePermanece = safe(data.docenteQuePermanece);
      const docenteNuevo = safe(data.docenteNuevo || docenteEntrante);

      const textoSegundoTipoA =
        data.varianteSegundoTipoA === VarianteSegundoTipoA.PRECISAR
          ? `**PRECISAR** que, a partir de la fecha, los dictaminantes de la tesis intitulada "${tesisTitulo}" son el/la **${docenteQuePermanece}** y el/la **${docenteNuevo}**, docentes del Departamento Académico de ${departamentoAcademico}.`
          : `**ACLARAR** que la Tesis: "${tesisTitulo}" ya se encuentra inscrita.`;

      return {
        visto,
        considerando,
        articulosResolutivos: [
          {
            titulo: 'PRIMERO.-',
            texto: buildPrimeroTipoAyB(),
          },
          {
            titulo: 'SEGUNDO.-',
            texto: textoSegundoTipoA,
          },
          {
            titulo: 'TERCERO.-',
            texto: `**ENCOMENDAR** a las dependencias que corresponda adoptar las medidas convenientes para el cumplimiento de la presente Resolución.`,
          },
        ],
      };
    }
  }
}