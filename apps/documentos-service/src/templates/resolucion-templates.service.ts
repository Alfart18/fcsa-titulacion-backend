// Ruta: apps/documentos-service/src/templates/resolucion-templates.service.ts
import { Injectable } from '@nestjs/common';

export enum SerieNumeracion {
  ORD = 'ORD',
  CF = 'CF',
}

export enum TipoResolucion {
  ASESOR = 'ASESOR',
  DICTAMEN = 'DICTAMEN',
  INSCRIPCION = 'INSCRIPCION',
  TERCER_DICT = 'TERCER_DICT',
  APTO = 'APTO',
  FECHA_HORA = 'FECHA_HORA',
  TITULO = 'TITULO',
  COASESOR = 'COASESOR',
  CAMBIO_ASESOR = 'CAMBIO_ASESOR',
  CAMBIO_TITULO = 'CAMBIO_TITULO',
  CAMBIO_DICTAMINANTE = 'CAMBIO_DICTAMINANTE',
  DSE = 'DSE',
  DESISTIMIENTO = 'DESISTIMIENTO',
}

export interface TesistaSnapshot {
  id: string;
  orden?: number;
  nombresApellidos: string;
  codigoEstudiante: string;
}

export interface SeccionesJuridicasResult {
  visto: string;
  considerando: string[];
  articulosResolutivos: Array<{ titulo: string; texto: string }>;
}

@Injectable()
export class ResolucionTemplatesService {
  formatearFechaLargaCastellano(fechaInput: Date | string): string {
    const fecha =
      fechaInput instanceof Date ? fechaInput : new Date(fechaInput);
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const dia = fecha.getUTCDate();
    const mes = meses[fecha.getUTCMonth()];
    const anio = fecha.getUTCFullYear();
    return `${dia} de ${mes} de ${anio}`;
  }

  formatearListaTesistas(
    tesistas: TesistaSnapshot[],
    _gradoBachiller?: string,
  ): {
    esPlural: boolean;
    articuloBachiller: string;
    listaFormateada: string;
  } {
    const esPlural = tesistas.length > 1;
    const articuloBachiller = esPlural
      ? 'los(las) señores(itas)'
      : 'el/la señor(ita)';

    const listaFormateada = tesistas
      .map((t) => `**${t.nombresApellidos.toUpperCase()}**`)
      .join(' y ');

    return { esPlural, articuloBachiller, listaFormateada };
  }

  sanitizarTextoWinAnsi(texto: string): string {
    return texto
      .replace(/[“”«»]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/•/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
  }

  construirSeccionesJuridicas(
    tipo: TipoResolucion,
    datos: Record<string, any>,
    codigoExpediente: string,
  ): SeccionesJuridicasResult {
    const escuela = String(
      datos.escuelaProfesionalSnapshot || 'Escuela Profesional',
    ).toUpperCase();
    const gradoBachiller = String(
      datos.gradoBachillerSnapshot || 'Bachiller',
    );
    const tituloProfesional = String(
      datos.tituloProfesionalSnapshot || 'Título Profesional',
    ).toUpperCase();
    const reglamentoMarco = String(
      datos.reglamentoMarcoSnapshot || 'Resolución N.º 513-CU-2024-UAC',
    );
    const tesistas: TesistaSnapshot[] = Array.isArray(datos.tesistasSnapshot)
      ? datos.tesistasSnapshot
      : [];

    const { esPlural, articuloBachiller, listaFormateada } =
      this.formatearListaTesistas(tesistas, gradoBachiller);

    switch (tipo) {
      case TipoResolucion.ASESOR: {
        const asesor = String(
          datos.asesorNombreCompletoSnapshot || '',
        ).toUpperCase();
        const detalleCarta = datos.fechaCartaAceptacion
          ? `de fecha ${this.formatearFechaLargaCastellano(datos.fechaCartaAceptacion)}, `
          : 'de aceptación ';
        const verboSolicitar = esPlural ? 'quienes solicitan' : 'quien solicita';

        return {
          visto: `La solicitud virtual presentado por ${articuloBachiller} ${listaFormateada}, solicitando nombramiento de asesor(a) de tesis, para optar al Título Profesional de **${tituloProfesional}** de la Universidad Andina del Cusco.`,
          considerando: [
            `Que, la Universidad Andina del Cusco, creada por Ley Nº23837 y autorizado su funcionamiento definitivo por Resolución Nº195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
            `Que, de acuerdo con el Reglamento Específico de Grados y Títulos de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco, ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela}**, solicitan el nombramiento de asesor(a) de tesis para optar al Título Profesional de **${tituloProfesional}**.`,
            `Que, en los antecedentes de la documentación tramitada se tiene la carta ${detalleCarta}suscrita por el/la **${asesor}**, manifestando su aceptación para el asesoramiento respectivo, por lo que a efectos de su oficialización se requiere del acto administrativo correspondiente.`,
            `Que, el Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones que le confiere la Ley Universitaria N°30220 y el Estatuto Universitario vigente.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**NOMBRAR** al/la **${asesor}** como **ASESOR(A)** del proyecto y trabajo de investigación (Tesis) de ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**, ${verboSolicitar} el nombramiento de asesor(a) de tesis para optar al Título Profesional de **${tituloProfesional}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**DETERMINAR** que el/la asesor(a) del proyecto de tesis está obligado a cumplir con las funciones establecidas como indica el literal (o) del Art. 29 del Reglamento General de Docentes y Jefes de Práctica.`,
            },
            {
              titulo: 'TERCERO. -',
              texto: `**SEÑALAR** que el proceso de titulación tiene un solo pago contemplado en el tarifario único de procesos administrativos (TUPA).`,
            },
            {
              titulo: 'CUARTO. -',
              texto: `**ENCARGAR,** el cumplimiento de la presente Resolución a las dependencias académicas correspondientes.`,
            },
          ],
        };
      }

      case TipoResolucion.DICTAMEN: {
        const titulo = String(datos.tituloProyecto || '');
        const d1 = String(datos.dictaminante1Snapshot || '').toUpperCase();
        const d2 = String(datos.dictaminante2Snapshot || '').toUpperCase();
        const resAsesor = String(datos.resolucionAsesorNumeroSnapshot || '');
        const asesor = String(
          datos.asesorNombreCompletoSnapshot || '',
        ).toUpperCase();
        const deptoDict = String(
          datos.departamentoDictaminantesSnapshot ||
            datos.asesorDepartamentoSnapshot ||
            'el departamento académico correspondiente',
        );
        return {
          visto: `El expediente ${codigoExpediente} y el informe favorable del Docente Asesor **${asesor}** (designado con Resolución N.º ${resAsesor}), mediante el cual ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela}**, solicita el nombramiento de Docentes Dictaminantes para la revisión del Proyecto de Tesis intitulado: "${titulo}"; y,`,
          considerando: [
            `Que, conforme a lo dispuesto en el Reglamento Marco de Grados y Títulos (${reglamentoMarco}), concluida la formulación del Proyecto de Tesis con el aval del Docente Asesor, el Decanato designa a dos (02) docentes dictaminantes para evaluar la viabilidad metodológica y científica del proyecto.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**DESIGNAR** como **DOCENTES DICTAMINANTES** del Proyecto de Tesis intitulado: "${titulo}", presentado por ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**, a los siguientes docentes adscritos al ${deptoDict}: **${d1}** (Primer Dictaminante); **${d2}** (Segundo Dictaminante).`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**OTORGAR** el plazo reglamentario para que los docentes designados emitan el dictamen correspondiente ante el Decanato de la Facultad de Ciencias de la Salud.`,
            },
          ],
        };
      }

      case TipoResolucion.INSCRIPCION: {
        const titulo = String(datos.tituloInscritoSnapshot || '');
        const folio = String(datos.numeroFolioLibroSnapshot || '');
        const resDict = String(datos.resolucionDictamenNumeroSnapshot || '');
        const asesor = String(
          datos.asesorNombreCompletoSnapshot || '',
        ).toUpperCase();
        const d1 = String(datos.dictaminante1Snapshot || '').toUpperCase();
        const d2 = String(datos.dictaminante2Snapshot || '').toUpperCase();
        return {
          visto: `El expediente ${codigoExpediente} y los dictámenes favorables emitidos por los docentes dictaminantes **${d1}** y **${d2}** (designados por Resolución N.º ${resDict}), respecto al Proyecto de Tesis presentado por ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**; y,`,
          considerando: [
            `Que, en cumplimiento de lo establecido en el Reglamento Marco de Grados y Títulos (${reglamentoMarco}), habiendo obtenido dictamen de conformidad, corresponde aprobar el Proyecto de Tesis y disponer su inscripción en el Libro Oficial de Inscripción de Temas de Tesis de la Escuela Profesional de **${escuela}**, otorgándose los derechos de exclusividad sobre el tema por el plazo reglamentario.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**APROBAR E INSCRIBIR** en el Libro de Inscripción de Temas de Tesis de la Escuela Profesional de **${escuela}** (Folio/Registro ${folio}), el Proyecto de Tesis intitulado: "${titulo}", presentado por ${articuloBachiller} ${listaFormateada}, contando con el asesoramiento de **${asesor}**.`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**AUTORIZAR** la ejecución y desarrollo del trabajo de investigación conforme al cronograma aprobado.`,
            },
          ],
        };
      }

      case TipoResolucion.TERCER_DICT: {
        const titulo = String(datos.tituloVigenteSnapshot || '');
        const d3 = String(datos.dictaminante3Snapshot || '').toUpperCase();
        const resIns = String(datos.resolucionInscripcionNumeroSnapshot || '');
        const resDict = String(datos.resolucionDictamenNumeroSnapshot || '');
        return {
          visto: `El expediente ${codigoExpediente} correspondiente a ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**, y los informes discrepantes presentados por la comisión designada mediante Resolución N.º ${resDict || resIns}; y,`,
          considerando: [
            `Que, de acuerdo con el Reglamento Marco de Grados y Títulos (${reglamentoMarco}), ante la existencia de dictámenes discrepantes sobre la evaluación de la tesis intitulada "${titulo}", corresponde designar a un Tercer Docente Dictaminante con carácter dirimente.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'ÚNICO. -',
              texto: `**DESIGNAR** a **${d3}** como **TERCER DOCENTE DICTAMINANTE (DIRIMENTE)** de la Tesis intitulada: "${titulo}", presentada por ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**.`,
            },
          ],
        };
      }

      case TipoResolucion.APTO: {
        const tesistaNom = String(
          datos.tesistaNombresSnapshot || '',
        ).toUpperCase();
        const titulo = String(datos.tituloVigenteSnapshot || '');
        const resIns = String(datos.resolucionInscripcionNumeroSnapshot || '');
        const porcentaje = String(datos.porcentajeSimilitud || 'N/A');
        return {
          visto: `El expediente ${codigoExpediente} presentado por el/la señor(ita) **${tesistaNom}**, de la Escuela Profesional de **${escuela}**, solicitando ser declarado(a) **APTO(A)** para la sustentación oral del trabajo de tesis intitulado: "${titulo}" (inscrito mediante Resolución N.º ${resIns}); y,`,
          considerando: [
            `Que, habiéndose concluido el borrador final de tesis con dictámenes de suficiencia favorables, constancia de originalidad (porcentaje de similitud: ${porcentaje}) e informe de conformidad de expedito académico de acuerdo con el ${reglamentoMarco}, resulta procedente declarar apto(a) al/a la solicitante.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'ÚNICO. -',
              texto: `**DECLARAR APTO(A)** a el/la señor(ita) **${tesistaNom}**, de la Escuela Profesional de **${escuela}**, para optar al Título Profesional de **${tituloProfesional}** mediante la sustentación oral de la Tesis intitulada: "${titulo}".`,
            },
          ],
        };
      }

      case TipoResolucion.FECHA_HORA: {
        const titulo = String(datos.tituloVigenteSnapshot || '');
        const fechaSust = String(datos.fechaSustentacion || '');
        const horaSust = String(datos.horaSustentacion || '');
        const modalidad = String(datos.modalidad || '');
        const lugar = String(datos.lugarReferencia || '');
        const jurado = datos.juradoSnapshot || {};
        const presidente = String(jurado.presidente || '').toUpperCase();
        const primerMiembro = String(
          jurado.primerMiembro || jurado.dictaminante1 || '',
        ).toUpperCase();
        const segundoMiembro = String(
          jurado.segundoMiembro || jurado.dictaminante2 || '',
        ).toUpperCase();
        const asesor = String(
          datos.asesorNombreCompletoSnapshot || '',
        ).toUpperCase();

        return {
          visto: `El expediente ${codigoExpediente} mediante el cual ${articuloBachiller} ${listaFormateada}, declarado(s) APTO(S) de la Escuela Profesional de **${escuela}**, solicita(n) fijación de fecha, hora y nombramiento de Jurado Examinador para la sustentación de la Tesis intitulada: "${titulo}"; y,`,
          considerando: [
            `Que, en observancia del ${reglamentoMarco}, corresponde al Decanato nombrar al Jurado Examinador y programar el acto público de sustentación de tesis.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**NOMBRAR** al **JURADO EXAMINADOR** que recepcionará la sustentación oral de la Tesis intitulada: "${titulo}", presentada por ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**, integrado por: Presidente: **${presidente}**; Primer Miembro (Dictaminante): **${primerMiembro}**; Segundo Miembro (Dictaminante): **${segundoMiembro}**; Docente Asesor (con voz y sin voto): **${asesor}**.`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**FIJAR** como fecha y hora para el acto de sustentación el día **${fechaSust}** a horas **${horaSust}**, en la modalidad ${modalidad} (${lugar}).`,
            },
          ],
        };
      }

      case TipoResolucion.TITULO: {
        const tesistaNom = String(
          datos.tesistaNombresSnapshot || '',
        ).toUpperCase();
        const titulo = String(datos.tituloFinalSnapshot || '');
        const nota = Number(datos.notaSustentacion || 0);
        const mencion = String(datos.resultadoSustentacion || '');
        const fechaReal = String(datos.fechaSustentacionReal || '');
        const sesionConsejo = String(
          datos.sesionConsejoFecha || 'la fecha de la sesión',
        );
        const numRegistro = String(
          datos.numeroRegistroLibroTituloSnapshot || 'el que corresponda',
        );
        return {
          visto: `El expediente ${codigoExpediente}, el Acta de Sustentación de Tesis de fecha ${fechaReal} en la cual el(la) ${gradoBachiller} **${tesistaNom}** aprobó con nota ${nota} (${mencion}) la defensa de la tesis "${titulo}", y el acuerdo del Consejo de Facultad en sesión de fecha ${sesionConsejo}; y,`,
          considerando: [
            `Que, habiendo cumplido satisfactoriamente con todos los requisitos académicos y administrativos exigidos por el Reglamento Marco de Grados y Títulos (${reglamentoMarco}), el Consejo de Facultad de la Facultad de Ciencias de la Salud acordó aprobar el otorgamiento del Título Profesional correspondiente e inscribirlo en el Libro Oficial de Títulos (Registro N.º ${numRegistro}).`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**APROBAR** el otorgamiento del **TÍTULO PROFESIONAL DE ${tituloProfesional}** a favor de el/la **${gradoBachiller.toUpperCase()} ${tesistaNom}**, de la Escuela Profesional de **${escuela}** de la Facultad de Ciencias de la Salud.`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**ELEVAR** la presente Resolución y el expediente respectivo al Consejo Universitario de la Universidad Andina del Cusco para que confiera el Título Profesional y disponga la expedición del diploma correspondiente.`,
            },
          ],
        };
      }

      case TipoResolucion.COASESOR: {
        const titulo = String(
          datos.tituloVigenteSnapshot || datos.tituloProyecto || '',
        );
        const asesor = String(
          datos.asesorNombreCompletoSnapshot || '',
        ).toUpperCase();
        const coasesor = String(
          datos.coasesorNombreCompletoSnapshot || '',
        ).toUpperCase();
        return {
          visto: `El expediente ${codigoExpediente} presentado por ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**, solicitando la incorporación de un Coasesor para el desarrollo de la Tesis intitulada: "${titulo}"; y,`,
          considerando: [
            `Que, la naturaleza especializada e interdisciplinaria del tema de investigación justifica contar con el acompañamiento complementario de un Coasesor, en concordancia con el ${reglamentoMarco} y con la conformidad del Docente Asesor principal **${asesor}**.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'ÚNICO. -',
              texto: `**DESIGNAR** a **${coasesor}** como **COASESOR** del trabajo de Tesis intitulado: "${titulo}", presentado por ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**.`,
            },
          ],
        };
      }

      case TipoResolucion.CAMBIO_ASESOR: {
        const antNum = String(datos.resolucionAntecedenteNumeroSnapshot || '');
        const saliente = String(
          datos.asesorSalienteSnapshot || '',
        ).toUpperCase();
        const entrante = String(
          datos.asesorNombreCompletoSnapshot || '',
        ).toUpperCase();
        const causa = String(datos.causaTextoConsolidadoSnapshot || '');
        const titulo = String(datos.tituloVigenteSnapshot || '');
        return {
          visto: `El expediente ${codigoExpediente} mediante el cual ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela}**, solicita el cambio de Docente Asesor por causal de ${causa} respecto a la Resolución N.º ${antNum}; y,`,
          considerando: [
            `Que, encontrándose acreditada la causal invocada conforme al ${reglamentoMarco}, corresponde modificar la Resolución N.º ${antNum} y designar al nuevo Docente Asesor para garantizar la continuidad de la Tesis intitulada: "${titulo}".`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**MODIFICAR** la Resolución N.º ${antNum}, dando por concluida la designación de **${saliente}** y **DESIGNANDO** en su reemplazo a **${entrante}** como nuevo **DOCENTE ASESOR** de la Tesis intitulada: "${titulo}", presentada por ${articuloBachiller} ${listaFormateada}.`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**MANTENER** subsistentes los demás extremos que no se opongan a la presente Resolución.`,
            },
          ],
        };
      }

      case TipoResolucion.CAMBIO_TITULO: {
        const antNum = String(datos.resolucionAntecedenteNumeroSnapshot || '');
        const dice = String(datos.diceTituloAnterior || '');
        const debeDecir = String(datos.debeDecirNuevoTitulo || '');
        const asesor = String(
          datos.asesorNombreCompletoSnapshot || '',
        ).toUpperCase();
        return {
          visto: `El expediente ${codigoExpediente} y el informe técnico favorable del Docente Asesor **${asesor}**, mediante el cual ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}** solicita la precisión o modificación del título de tesis aprobado con Resolución N.º ${antNum}; y,`,
          considerando: [
            `Que, de acuerdo con el ${reglamentoMarco}, procede la actualización del título cuando responde a observaciones de los dictaminantes o ajustes metodológicos que no alteran la esencia del tema inscrito.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**MODIFICAR** el título del trabajo de investigación aprobado por Resolución N.º ${antNum}, debiendo registrarse en adelante bajo la denominación oficial: "${debeDecir}" (antes: "${dice}"), correspondiente a ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**.`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**DISPONER** la anotación marginal de la presente modificación en el Libro de Inscripción de Temas de Tesis correspondiente.`,
            },
          ],
        };
      }

      case TipoResolucion.CAMBIO_DICTAMINANTE: {
        const antNum = String(datos.resolucionAntecedenteNumeroSnapshot || '');
        const saliente = String(
          datos.dictaminanteSalienteSnapshot || '',
        ).toUpperCase();
        const entrante = String(
          datos.dictaminanteEntranteSnapshot || '',
        ).toUpperCase();
        const causa = String(datos.causaTextoConsolidadoSnapshot || '');
        const titulo = String(datos.tituloVigenteSnapshot || '');
        return {
          visto: `El expediente ${codigoExpediente} correspondiente a ${articuloBachiller} ${listaFormateada} de la Escuela Profesional de **${escuela}**, sobre reconformación de Comisión Dictaminadora por causal de ${causa} respecto a la Resolución N.º ${antNum}; y,`,
          considerando: [
            `Que, a fin de no perjudicar los plazos de evaluación del Proyecto/Borrador de Tesis intitulado: "${titulo}", y en aplicación del ${reglamentoMarco}, resulta necesario subrogar al docente impedido y designar un nuevo integrante.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**MODIFICAR** la Resolución N.º ${antNum}, incorporando a **${entrante}** como Docente Dictaminante en reemplazo de **${saliente}**, para la evaluación de la Tesis de ${articuloBachiller} ${listaFormateada} (**${escuela}**).`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**DEJAR SUBSISTENTES** los demás extremos de la Resolución N.º ${antNum}.`,
            },
          ],
        };
      }

      case TipoResolucion.DSE: {
        const afectadas: Array<{ numeroCompleto: string; tipo: string }> =
          Array.isArray(datos.resolucionesAfectadasSnapshot)
            ? datos.resolucionesAfectadasSnapshot
            : [];
        const listaNumeros = afectadas
          .map((a) => `${a.numeroCompleto} (${a.tipo})`)
          .join(', ');
        const causa = String(datos.causaTextoConsolidadoSnapshot || '');
        const disposicion = datos.disposicionComplementaria
          ? String(datos.disposicionComplementaria)
          : null;

        const articulos = [
          {
            titulo: 'PRIMERO. -',
            texto: `**DEJAR SIN EFECTO** en todos sus extremos la(s) Resolución(es) N.º ${listaNumeros}, en mérito a los fundamentos expuestos en la parte considerativa de la presente Resolución.`,
          },
        ];

        if (disposicion) {
          articulos.push({
            titulo: 'SEGUNDO. -',
            texto: disposicion,
          });
        } else {
          articulos.push({
            titulo: 'SEGUNDO. -',
            texto: `**DISPONER** que Secretaría Académica registre la baja o reversión de estado en los libros y registros del sistema de grados y títulos.`,
          });
        }

        return {
          visto: `El informe de Secretaría Académica (Expediente ref.: ${codigoExpediente}) por el cual se solicita dejar sin efecto la(s) Resolución(es) N.º ${listaNumeros} por motivo de: ${causa}; y,`,
          considerando: [
            `Que, dentro de la potestad de autotutela administrativa y en observancia del Reglamento Marco de Grados y Títulos (${reglamentoMarco}), corresponde dejar sin efecto los actos resolutivos afectados por causal sobreviniente o vicio advertido, actualizando los registros y libros oficiales correspondientes.`,
          ],
          articulosResolutivos: articulos,
        };
      }

      case TipoResolucion.DESISTIMIENTO: {
        const desisteNom = String(
          datos.tesistaDesistenteNombresSnapshot || '',
        ).toUpperCase();
        const titulo = String(datos.tituloVigenteSnapshot || '');
        const causa = String(datos.causaTextoConsolidadoSnapshot || '');
        return {
          visto: `El expediente ${codigoExpediente} y la solicitud con firma legalizada presentada por el/la señor(ita) **${desisteNom}**, de la Escuela Profesional de **${escuela}**, formulando desistimiento respecto al desarrollo del trabajo de Tesis intitulado: "${titulo}"; y,`,
          considerando: [
            `Que, al amparo del Texto Único Ordenado de la Ley N.º 27444 y del Reglamento Marco de Grados y Títulos (${reglamentoMarco}), procede aceptar el desistimiento voluntario formulado por el(la) interesado(a) (${causa || 'por las razones expuestas'}).`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**ACEPTAR EL DESISTIMIENTO** presentado por el/la señor(ita) **${desisteNom}**, de la Escuela Profesional de **${escuela}**, respecto al trabajo de Tesis intitulado: "${titulo}" tramitado en el expediente ${codigoExpediente}.`,
            },
            {
              titulo: 'SEGUNDO. -',
              texto: `**ACTUALIZAR** la condición del(de la) solicitante en los registros de la Coordinación de Grados y Títulos y Secretaría Académica de la Facultad de Ciencias de la Salud.`,
            },
          ],
        };
      }

      default: {
        return {
          visto: `El expediente ${codigoExpediente} presentado para revisión y trámite correspondiente.`,
          considerando: [
            `Que, de conformidad con el Reglamento Marco de Grados y Títulos de la Universidad Andina del Cusco, corresponde emitir el pronunciamiento respectivo.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO. -',
              texto: `**DISPONER** lo que corresponda según el trámite regular de la Escuela Profesional de **${escuela}**.`,
            },
          ],
        };
      }
    }
  }
}