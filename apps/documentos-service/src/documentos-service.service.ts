import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { SerieNumeracion, TipoResolucion } from '@prisma/client';
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

interface TesistaSnapshot {
  id: string;
  orden?: number;
  nombresApellidos: string;
  codigoEstudiante: string;
}

interface SegmentoTexto {
  texto: string;
  negrita?: boolean;
  cursiva?: boolean;
}

@Injectable()
export class DocumentosServiceService {
  constructor(private readonly prisma: PrismaService) {}

  private formatearFechaLargaCastellano(fecha: Date): string {
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

  private formatearListaTesistas(
    tesistas: TesistaSnapshot[],
    gradoBachiller: string,
  ): {
    esPlural: boolean;
    articuloBachiller: string;
    listaFormateada: string;
  } {
    const esPlural = tesistas.length > 1;
    const articuloBachiller = esPlural
      ? `los Bachilleres (${gradoBachiller})`
      : `el(la) ${gradoBachiller}`;

    const listaFormateada = tesistas
      .map((t) => `${t.nombresApellidos} (Código: ${t.codigoEstudiante})`)
      .join(' y ');

    return { esPlural, articuloBachiller, listaFormateada };
  }

  /**
   * Sanitiza caracteres fuera de WinAnsiEncoding (ISO-8859-1) conservando intactas
   * todas las tildes del español (áéíóúÁÉÍÓÚ), eñes (ñÑ), diéresis (üÜ) y símbolo de grado (°).
   */
  private sanitizarTextoWinAnsi(texto: string): string {
    return texto
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/•/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
  }

  /**
   * Construye las secciones jurídicas VISTO, CONSIDERANDO y SE RESUELVE a partir
   * del snapshot inmutable almacenado en resolucion.datosEspecificos.
   */
  private construirSeccionesJuridicas(
    tipo: TipoResolucion,
    datos: Record<string, any>,
    codigoExpediente: string,
  ): {
    visto: string;
    considerando: string[];
    articulosResolutivos: Array<{ titulo: string; texto: string }>;
  } {
    const escuela = String(datos.escuelaProfesionalSnapshot || 'Escuela Profesional');
    const gradoBachiller = String(datos.gradoBachillerSnapshot || 'Bachiller');
    const tituloProfesional = String(datos.tituloProfesionalSnapshot || 'Título Profesional');
    const tesistas: TesistaSnapshot[] = Array.isArray(datos.tesistasSnapshot)
      ? datos.tesistasSnapshot
      : [];

    const { esPlural, articuloBachiller, listaFormateada } = this.formatearListaTesistas(
      tesistas,
      gradoBachiller,
    );

    switch (tipo) {
      case TipoResolucion.ASESOR: {
        const asesor = String(datos.asesorNombreCompletoSnapshot || '');
        const depto = String(datos.asesorDepartamentoSnapshot || '');
        return {
          visto: `El expediente administrativo ${codigoExpediente} presentado por ${articuloBachiller} ${listaFormateada}, de la ${escuela}, mediante el cual solicita${esPlural ? 'n' : ''} la designación de Docente Asesor de Tesis para optar al Título Profesional de ${tituloProfesional}; y,`,
          considerando: [
            `Que, de conformidad con el Reglamento Marco de Grados y Títulos de la Universidad Andina del Cusco y el Reglamento Específico de la Facultad de Ciencias de la Salud, el proceso de titulación por modalidad de tesis se inicia con el nombramiento de un Docente Asesor encargado de orientar el trabajo de investigación.`,
            `Que, el(la) docente ${asesor}, adscrito(a) al ${depto}, cumple con los requisitos académicos y reglamentarios para asumir el asesoramiento del referido proyecto de tesis.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `DESIGNAR al(a la) docente ${asesor}, adscrito(a) al ${depto}, como DOCENTE ASESOR(A) del Proyecto de Tesis presentado por ${articuloBachiller} ${listaFormateada}, de la ${escuela.toUpperCase()}, para optar al Título Profesional de ${tituloProfesional.toUpperCase()}.`,
            },
            {
              titulo: 'SEGUNDO.-',
              texto: `ENCARGAR a la Secretaría Académica de la Facultad de Ciencias de la Salud la notificación de la presente Resolución al(a la) docente asesor(a) y a ${esPlural ? 'los interesados' : 'la parte interesada'} para el cumplimiento de las disposiciones reglamentarias vigentes.`,
            },
          ],
        };
      }

      case TipoResolucion.DICTAMEN: {
        const titulo = String(datos.tituloProyecto || '');
        const d1 = String(datos.dictaminante1Snapshot || '');
        const d2 = String(datos.dictaminante2Snapshot || '');
        const resAsesor = String(datos.resolucionAsesorNumeroSnapshot || '');
        return {
          visto: `El expediente ${codigoExpediente} y la Resolución N.° ${resAsesor}, mediante los cuales ${articuloBachiller} ${listaFormateada}, de la ${escuela}, solicita${esPlural ? 'n' : ''} la designación de Docentes Dictaminantes para el Proyecto de Tesis; y,`,
          considerando: [
            `Que, contando con la conformidad del Docente Asesor designado mediante Resolución N.° ${resAsesor}, corresponde nombrar a dos (02) docentes dictaminantes encargados de revisar y emitir dictamen técnico-académico sobre el proyecto de investigación.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `DESIGNAR como DOCENTES DICTAMINANTES del Proyecto de Tesis titulado "${titulo}", presentado por ${articuloBachiller} ${listaFormateada} de la ${escuela.toUpperCase()}, a los siguientes docentes:\n- ${d1}\n- ${d2}`,
            },
            {
              titulo: 'SEGUNDO.-',
              texto: `OTORGAR a los docentes dictaminantes el plazo reglamentario para la presentación del informe de dictamen correspondiente ante la Decanatura de la Facultad de Ciencias de la Salud.`,
            },
          ],
        };
      }

      case TipoResolucion.INSCRIPCION: {
        const titulo = String(datos.tituloInscritoSnapshot || '');
        const folio = String(datos.numeroFolioLibroSnapshot || '');
        const resDict = String(datos.resolucionDictamenNumeroSnapshot || '');
        const asesor = String(datos.asesorNombreCompletoSnapshot || '');
        return {
          visto: `El dictamen favorable emitido por los docentes dictaminantes designados mediante Resolución N.° ${resDict} en el expediente ${codigoExpediente}; y,`,
          considerando: [
            `Que, habiendo obtenido dictamen favorable de los docentes revisores, corresponde autorizar la inscripción oficial del Proyecto de Tesis en el Libro de Inscripción de la ${escuela}.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `AUTORIZAR LA INSCRIPCIÓN del Proyecto de Tesis titulado "${titulo}", presentado por ${articuloBachiller} ${listaFormateada}, con el asesoramiento de ${asesor}, quedando registrado en el Libro de Inscripción de Proyectos de la ${escuela.toUpperCase()} bajo el Folio/Asiento N.° ${folio}.`,
            },
          ],
        };
      }

      case TipoResolucion.TERCER_DICT: {
        const titulo = String(datos.tituloVigenteSnapshot || '');
        const d1 = String(datos.dictaminante1Snapshot || '');
        const d2 = String(datos.dictaminante2Snapshot || '');
        const d3 = String(datos.dictaminante3Snapshot || '');
        const resIns = String(datos.resolucionInscripcionNumeroSnapshot || '');
        return {
          visto: `El expediente ${codigoExpediente} con Proyecto de Tesis inscrito mediante Resolución N.° ${resIns}; y,`,
          considerando: [
            `Que, concluida la ejecución del trabajo de investigación, el Reglamento de Grados y Títulos establece la incorporación de un Tercer Dictaminante para conformar la terna evaluadora del informe final de tesis.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `DESIGNAR al(a la) docente ${d3} como TERCER DICTAMINANTE de la Tesis titulada "${titulo}", presentada por ${articuloBachiller} ${listaFormateada}, conformando la terna completa de Dictaminantes de la Tesis junto con ${d1} y ${d2}.`,
            },
          ],
        };
      }

      case TipoResolucion.APTO: {
        const tesistaNom = String(datos.tesistaNombresSnapshot || '');
        const tesistaCod = String(datos.tesistaCodigoSnapshot || '');
        const informe = String(datos.numeroInformeSecretaria || '');
        const fechaInf = String(datos.fechaInformeSecretaria || '');
        return {
          visto: `El Informe N.° ${informe} de fecha ${fechaInf} emitido por la Secretaría Académica de la Facultad de Ciencias de la Salud en el expediente ${codigoExpediente}; y,`,
          considerando: [
            `Que, el(la) ${gradoBachiller} ${tesistaNom} (Código: ${tesistaCod}) ha cumplido con todos los requisitos académicos, administrativos y reglamentarios exigidos por la Universidad Andina del Cusco para ser declarado(a) apto(a) para la sustentación de tesis.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `DECLARAR APTO(A) al(a la) ${gradoBachiller.toUpperCase()} ${tesistaNom} (Código: ${tesistaCod}), de la ${escuela.toUpperCase()}, para optar al Título Profesional de ${tituloProfesional.toUpperCase()} mediante el acto público de sustentación de tesis.`,
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
        return {
          visto: `El expediente ${codigoExpediente} con resolución(es) de declaratoria de Apto vigente(s); y,`,
          considerando: [
            `Que, habiéndose declarado apto(s) a ${articuloBachiller} ${listaFormateada}, corresponde fijar fecha, hora y lugar para el acto público de sustentación, así como designar al Jurado Evaluador.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `FIJAR como Fecha y Hora para el acto público de sustentación de la Tesis titulada "${titulo}", presentada por ${articuloBachiller} ${listaFormateada}, el día ${fechaSust} a horas ${horaSust}, bajo la modalidad ${modalidad} (${lugar}).`,
            },
            {
              titulo: 'SEGUNDO.-',
              texto: `CONFORMAR el Jurado Evaluador del acto de sustentación de la siguiente manera:\n- PRESIDENTE: ${jurado.presidenteSnapshot}\n- SECRETARIO: ${jurado.secretarioSnapshot}\n- VOCAL / DICTAMINANTE: ${jurado.vocalSnapshot}\n- ASESOR: ${jurado.asesorSnapshot}`,
            },
          ],
        };
      }

      case TipoResolucion.TITULO: {
        const tesistaNom = String(datos.tesistaNombresSnapshot || '');
        const tesistaCod = String(datos.tesistaCodigoSnapshot || '');
        const titulo = String(datos.tituloFinalSnapshot || '');
        const nota = Number(datos.notaSustentacion || 0);
        const mencion = String(datos.resultadoSustentacion || '');
        const fechaReal = String(datos.fechaSustentacionReal || '');
        return {
          visto: `El Acta de Sustentación de Tesis de fecha ${fechaReal} correspondiente al expediente ${codigoExpediente}; y,`,
          considerando: [
            `Que, en fecha ${fechaReal}, el(la) ${gradoBachiller} ${tesistaNom} sustentó públicamente la tesis titulada "${titulo}", obteniendo la calificación aprobatoria de ${nota} puntos (${mencion}).`,
            `Que, el Consejo de Facultad de Ciencias de la Salud ha aprobado el expediente de titulación para su elevación al Vicerrectorado Académico y Consejo Universitario.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `APROBAR el expediente de titulación del(de la) ${gradoBachiller.toUpperCase()} ${tesistaNom} (Código: ${tesistaCod}), quien aprobó la sustentación de la tesis titulada "${titulo}" con la calificación de ${nota} puntos (${mencion}), para el otorgamiento del Título Profesional de ${tituloProfesional.toUpperCase()}.`,
            },
            {
              titulo: 'SEGUNDO.-',
              texto: `ELEVAR la presente Resolución y el expediente respectivo al Vicerrectorado Académico de la Universidad Andina del Cusco para su ratificación y emisión del diploma correspondiente.`,
            },
          ],
        };
      }

      case TipoResolucion.CAMBIO_ASESOR: {
        const antNum = String(datos.resolucionAntecedenteNumeroSnapshot || '');
        const saliente = String(datos.asesorSalienteSnapshot || '');
        const entrante = String(datos.asesorNombreCompletoSnapshot || '');
        const causa = String(datos.causaTextoConsolidadoSnapshot || '');
        return {
          visto: `La solicitud de cambio de docente asesor en el expediente ${codigoExpediente} por causal de ${causa}; y,`,
          considerando: [
            `Que, mediante Resolución N.° ${antNum} se designó como asesor(a) a ${saliente}; sin embargo, habiéndose acreditado la causal de "${causa}", resulta procedente designar a un nuevo Docente Asesor.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `MODIFICAR la Resolución N.° ${antNum}, dando por concluida la designación de ${saliente} por motivo de ${causa.toUpperCase()}, y DESIGNAR como nuevo(a) DOCENTE ASESOR(A) a ${entrante} para el expediente ${codigoExpediente} presentado por ${articuloBachiller} ${listaFormateada}.`,
            },
          ],
        };
      }

      case TipoResolucion.CAMBIO_TITULO: {
        const antNum = String(datos.resolucionAntecedenteNumeroSnapshot || '');
        const dice = String(datos.diceTituloAnterior || '');
        const debeDecir = String(datos.debeDecirNuevoTitulo || '');
        return {
          visto: `El expediente ${codigoExpediente} sobre modificación de título de trabajo de investigación; y,`,
          considerando: [
            `Que, mediante Resolución N.° ${antNum} se registró el título del trabajo de investigación, habiéndose aprobado la precisión y actualización denominativa del referido título.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `MODIFICAR el título del trabajo de investigación consignado en la Resolución N.° ${antNum}, correspondiente a ${articuloBachiller} ${listaFormateada} de la ${escuela.toUpperCase()}, conforme al siguiente detalle:\nDICE: "${dice}"\nDEBE DECIR: "${debeDecir}"`,
            },
          ],
        };
      }

      case TipoResolucion.CAMBIO_DICTAMINANTE: {
        const antNum = String(datos.resolucionAntecedenteNumeroSnapshot || '');
        const saliente = String(datos.dictaminanteSalienteSnapshot || '');
        const entrante = String(datos.dictaminanteEntranteSnapshot || '');
        const causa = String(datos.causaTextoConsolidadoSnapshot || '');
        const esTercero = Boolean(datos.esModalidadTercerDictaminante);
        const d1 = String(datos.dictaminante1Snapshot || '');
        const d2 = String(datos.dictaminante2Snapshot || '');
        const d3 = String(datos.dictaminante3Snapshot || '');

        const articulos = [
          {
            titulo: 'PRIMERO.-',
            texto: `MODIFICAR EN PARTE la Resolución N.° ${antNum}, reemplazando al(a la) docente dictaminante ${saliente} por el(la) docente ${entrante}, por causal de ${causa.toUpperCase()}.`,
          },
        ];

        if (esTercero) {
          articulos.push(
            {
              titulo: 'SEGUNDO.-',
              texto: `REAFIRMAR que la terna completa de Dictaminantes de la Tesis del expediente ${codigoExpediente} queda conformada por los docentes: ${d1}, ${d2} y ${d3}.`,
            },
            {
              titulo: 'TERCERO.-',
              texto: `DISPONER el cumplimiento de los plazos reglamentarios para la emisión del dictamen correspondiente.`,
            },
          );
        }

        return {
          visto: `El expediente ${codigoExpediente} sobre reemplazo de docente dictaminante por causal de ${causa}; y,`,
          considerando: [
            `Que, habiéndose presentado la causal de "${causa}" respecto de ${saliente}, corresponde designar a su reemplazo para garantizar la continuidad del proceso de evaluación.`,
          ],
          articulosResolutivos: articulos,
        };
      }

      case TipoResolucion.DESISTIMIENTO: {
        const desisteNom = String(datos.tesistaDesistenteNombresSnapshot || '');
        const desisteCod = String(datos.tesistaDesistenteCodigoSnapshot || '');
        const continuaNom = String(datos.tesistaContinuaNombresSnapshot || '');
        const continuaCod = String(datos.tesistaContinuaCodigoSnapshot || '');
        const solicitud = String(datos.referenciaSolicitudExterna || '');
        return {
          visto: `La solicitud con registro ${solicitud} presentada por ${desisteNom} (Código: ${desisteCod}) en el expediente colectivo ${codigoExpediente}; y,`,
          considerando: [
            `Que, en los trabajos de tesis desarrollados por dos tesistas, el desistimiento formal de uno de ellos antes de la programación de fecha y hora de sustentación faculta al tesista restante a continuar individualmente con el expediente.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `ACEPTAR EL DESISTIMIENTO presentado mediante solicitud ${solicitud} por ${desisteNom} (Código: ${desisteCod}), apartándolo(a) del expediente de titulación ${codigoExpediente}.`,
            },
            {
              titulo: 'SEGUNDO.-',
              texto: `AUTORIZAR que el(la) ${gradoBachiller} ${continuaNom} (Código: ${continuaCod}) continúe individualmente con el trámite del expediente ${codigoExpediente}, conservando la validez del título, asesor y dictaminantes vigentes.`,
            },
          ],
        };
      }

      case TipoResolucion.DSE: {
        const afectadas: Array<{ numeroCompleto: string; tipo: string }> = Array.isArray(
          datos.resolucionesAfectadasSnapshot,
        )
          ? datos.resolucionesAfectadasSnapshot
          : [];
        const listaNumeros = afectadas.map((a) => `${a.numeroCompleto} (${a.tipo})`).join(', ');
        const causa = String(datos.causaTextoConsolidadoSnapshot || '');
        const reinicio = Boolean(datos.reinicioIntegral);
        const disposicion = datos.disposicionComplementaria
          ? String(datos.disposicionComplementaria)
          : null;

        const articulos = [
          {
            titulo: 'PRIMERO.-',
            texto: `DEJAR SIN EFECTO en todos sus extremos la(s) Resolución(es) N.° ${listaNumeros}, correspondiente(s) al expediente ${codigoExpediente}, por causal de ${causa.toUpperCase()}${reinicio ? ', disponiéndose el REINICIO INTEGRAL del trámite y la anulación del expediente actual' : ''}.`,
          },
        ];

        if (disposicion) {
          articulos.push({
            titulo: 'SEGUNDO.-',
            texto: disposicion,
          });
        }

        return {
          visto: `El expediente ${codigoExpediente} sobre nulidad / dejar sin efecto de acto administrativo por causal de ${causa}; y,`,
          considerando: [
            `Que, habiéndose verificado la causal de "${causa}", corresponde dejar sin efecto la(s) resolución(es) afectada(s) a fin de preservar la legalidad y exactitud del registro administrativo de la Facultad de Ciencias de la Salud.`,
          ],
          articulosResolutivos: articulos,
        };
      }
    }
  }

  /**
   * Genera el PDF oficial usando 100% pdf-lib puro con StandardFonts.TimesRoman,
   * maquetación justificada real y Sello de Doble Vía (Pie de página + Metadatos PDF).
   */
  async generarPdfResolucion(resolucionId: string): Promise<{
    buffer: Buffer;
    nombreArchivo: string;
    selloControl: string;
  }> {
    const resolucion = await this.prisma.resolucion.findUnique({
      where: { id: resolucionId },
      include: {
        expediente: {
          select: {
            codigoExpediente: true,
          },
        },
      },
    });

    if (!resolucion) {
      throw new NotFoundException('La resolución solicitada no existe.');
    }

    const config = await this.prisma.configuracionInstitucional.findFirst();
    const universidad = this.sanitizarTextoWinAnsi(
      (config?.universidad || 'UNIVERSIDAD ANDINA DEL CUSCO').toUpperCase(),
    );
    const facultad = this.sanitizarTextoWinAnsi(
      (config?.facultad || 'FACULTAD DE CIENCIAS DE LA SALUD').toUpperCase(),
    );
    const ciudad = this.sanitizarTextoWinAnsi(config?.ciudad || 'Cusco');

    const datosEspecificos = (resolucion.datosEspecificos as Record<string, any>) || {};
    const secciones = this.construirSeccionesJuridicas(
      resolucion.tipo,
      datosEspecificos,
      resolucion.expediente.codigoExpediente,
    );

    const denominacionSerie =
      resolucion.serie === SerieNumeracion.CF
        ? 'RESOLUCIÓN DE CONSEJO DE FACULTAD'
        : 'RESOLUCIÓN DE DECANATO';

    const selloControl = `ID-TRAMITE: ${resolucion.idTramiteControl} | VER: ${resolucion.versionPdf} | HASH: ${resolucion.hashVersionGenerado}`;

    // 1. Crear el documento PDF en memoria e incrustar fuentes estándar ISO (cero archivos externos)
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const fontFooter = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Dimensiones A4 en puntos tipográficos (595.28 x 841.89)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const marginLeft = 65;
    const marginRight = 65;
    const marginTop = 60;
    const marginBottom = 75;
    const contentWidth = pageWidth - marginLeft - marginRight;

    const paginas: PDFPage[] = [];
    let paginaActual = pdfDoc.addPage([pageWidth, pageHeight]);
    paginas.push(paginaActual);
    let cursorY = pageHeight - marginTop;

    const verificarEspacioOSaltarPagina = (altoRequerido: number) => {
      if (cursorY - altoRequerido < marginBottom) {
        paginaActual = pdfDoc.addPage([pageWidth, pageHeight]);
        paginas.push(paginaActual);
        cursorY = pageHeight - marginTop;
      }
    };

    const dibujarTextoCentrado = (
      texto: string,
      font: PDFFont,
      size: number,
      espacioInferior: number,
      subrayado = false,
    ) => {
      const textoLimpio = this.sanitizarTextoWinAnsi(texto);
      verificarEspacioOSaltarPagina(size + espacioInferior);
      const textWidth = font.widthOfTextAtSize(textoLimpio, size);
      const x = marginLeft + (contentWidth - textWidth) / 2;

      paginaActual.drawText(textoLimpio, {
        x,
        y: cursorY,
        size,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });

      if (subrayado) {
        paginaActual.drawLine({
          start: { x, y: cursorY - 2 },
          end: { x: x + textWidth, y: cursorY - 2 },
          thickness: 0.8,
          color: rgb(0.05, 0.05, 0.05),
        });
      }

      cursorY -= size + espacioInferior;
    };

    const dibujarTextoDerecha = (
      texto: string,
      font: PDFFont,
      size: number,
      espacioInferior: number,
    ) => {
      const textoLimpio = this.sanitizarTextoWinAnsi(texto);
      verificarEspacioOSaltarPagina(size + espacioInferior);
      const textWidth = font.widthOfTextAtSize(textoLimpio, size);
      const x = pageWidth - marginRight - textWidth;

      paginaActual.drawText(textoLimpio, {
        x,
        y: cursorY,
        size,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });

      cursorY -= size + espacioInferior;
    };

    /**
     * Motor de maquetación de párrafos compuestos (negrita + normal + cursiva)
     * con soporte de saltos de línea explícitos (\n) y alineación justificada real.
     */
    const dibujarParrafoCompuesto = (
      segmentos: SegmentoTexto[],
      size = 11,
      lineHeight = 15.5,
      espacioInferior = 10,
      justificar = true,
    ) => {
      interface PalabraToken {
        palabra: string;
        font: PDFFont;
        ancho: number;
      }

      // Expandir segmentos respetando saltos de línea manuales (\n)
      const bloquesDeLinea: PalabraToken[][] = [[]];

      for (const seg of segmentos) {
        const font = seg.negrita ? fontBold : seg.cursiva ? fontItalic : fontRegular;
        const limpio = this.sanitizarTextoWinAnsi(seg.texto);
        const subLineas = limpio.split('\n');

        subLineas.forEach((subLinea, idxSub) => {
          if (idxSub > 0) {
            bloquesDeLinea.push([]);
          }
          const palabras = subLinea.trim().split(/\s+/).filter(Boolean);
          for (const palabra of palabras) {
            bloquesDeLinea[bloquesDeLinea.length - 1].push({
              palabra,
              font,
              ancho: font.widthOfTextAtSize(palabra, size),
            });
          }
        });
      }

      const anchoEspacioBase = fontRegular.widthOfTextAtSize(' ', size);

      for (const bloquePalabras of bloquesDeLinea) {
        if (bloquePalabras.length === 0) {
          cursorY -= lineHeight * 0.5;
          continue;
        }

        // Envolver palabras en líneas que quepan en contentWidth
        const lineasEnvueltas: PalabraToken[][] = [];
        let lineaActual: PalabraToken[] = [];
        let anchoAcumulado = 0;

        for (const token of bloquePalabras) {
          const espacioNecesario =
            lineaActual.length === 0 ? token.ancho : anchoEspacioBase + token.ancho;

          if (anchoAcumulado + espacioNecesario <= contentWidth || lineaActual.length === 0) {
            lineaActual.push(token);
            anchoAcumulado += espacioNecesario;
          } else {
            lineasEnvueltas.push(lineaActual);
            lineaActual = [token];
            anchoAcumulado = token.ancho;
          }
        }

        if (lineaActual.length > 0) {
          lineasEnvueltas.push(lineaActual);
        }

        // Dibujar cada línea calculando el espaciado inter-palabra para justificación
        lineasEnvueltas.forEach((linea, idxLinea) => {
          verificarEspacioOSaltarPagina(lineHeight);

          const esUltimaLineaDelBloque = idxLinea === lineasEnvueltas.length - 1;
          const totalAnchoPalabras = linea.reduce((acc, t) => acc + t.ancho, 0);

          let espacioEntrePalabras = anchoEspacioBase;
          if (justificar && !esUltimaLineaDelBloque && linea.length > 1) {
            const espacioDisponible = contentWidth - totalAnchoPalabras;
            const espacioCalculado = espacioDisponible / (linea.length - 1);
            // Limitar estiramiento excesivo si una línea tiene muy pocas palabras
            if (espacioCalculado <= anchoEspacioBase * 3.5) {
              espacioEntrePalabras = espacioCalculado;
            }
          }

          let x = marginLeft;
          for (const token of linea) {
            paginaActual.drawText(token.palabra, {
              x,
              y: cursorY,
              size,
              font: token.font,
              color: rgb(0.05, 0.05, 0.05),
            });
            x += token.ancho + espacioEntrePalabras;
          }

          cursorY -= lineHeight;
        });
      }

      cursorY -= espacioInferior;
    };

    // ========================================================================
    // 2. DIBUJAR ENCABEZADO OFICIAL UAC - FCSa
    // ========================================================================
    dibujarTextoCentrado(universidad, fontBold, 14, 4);
    dibujarTextoCentrado(facultad, fontBold, 11.5, 10);

    // Línea divisoria institucional
    paginaActual.drawLine({
      start: { x: marginLeft, y: cursorY },
      end: { x: pageWidth - marginRight, y: cursorY },
      thickness: 1,
      color: rgb(0.15, 0.2, 0.3),
    });
    cursorY -= 20;

    // Número de Resolución subrayado y centrado
    dibujarTextoCentrado(
      `${denominacionSerie} N.° ${resolucion.numeroCompleto}`,
      fontBold,
      12,
      16,
      true,
    );

    // Lugar y Fecha alineado a la derecha
    dibujarTextoDerecha(
      `${ciudad}, ${this.formatearFechaLargaCastellano(resolucion.fechaEmision)}`,
      fontRegular,
      11,
      18,
    );

    // ========================================================================
    // 3. DIBUJAR CUERPO JURÍDICO (VISTO, CONSIDERANDO, SE RESUELVE)
    // ========================================================================
    dibujarParrafoCompuesto([
      { texto: 'VISTO: ', negrita: true },
      { texto: secciones.visto },
    ]);

    dibujarParrafoCompuesto([{ texto: 'CONSIDERANDO:', negrita: true }], 11, 15, 6, false);

    for (const parrafo of secciones.considerando) {
      dibujarParrafoCompuesto([{ texto: parrafo }]);
    }

    dibujarParrafoCompuesto([
      {
        texto:
          'Estando a las atribuciones conferidas por el Estatuto Universitario y la Ley Universitaria N.° 30220;',
      },
    ]);

    dibujarParrafoCompuesto([{ texto: 'SE RESUELVE:', negrita: true }], 11, 15, 6, false);

    for (const art of secciones.articulosResolutivos) {
      dibujarParrafoCompuesto([
        { texto: `${art.titulo} `, negrita: true },
        { texto: art.texto },
      ]);
    }

    cursorY -= 6;
    dibujarParrafoCompuesto(
      [{ texto: 'Regístrese, comuníquese y archívese.', cursiva: true }],
      11,
      15,
      45,
      false,
    );

    // ========================================================================
    // 4. BLOQUE DE FIRMA DIGITAL Y PIE DE PÁGINA INSTITUCIONAL
    // ========================================================================
    verificarEspacioOSaltarPagina(80);
    cursorY -= 20;
    
    // En lugar de línea física, ponemos el texto de firma digital
    dibujarTextoCentrado('Firmado digitalmente por:', fontItalic, 10, 4);
    dibujarTextoCentrado(resolucion.nombreDecanoSnapshot.toUpperCase(), fontBold, 11, 2);
    dibujarTextoCentrado(`DECANO(A) DE LA ${facultad}`, fontRegular, 9.5, 15);

    // Iniciales (AAT / AVC / JAAFD)
    dibujarTextoCentrado(
      `Iniciales: ${resolucion.inicialesOperador} / JAAFD`, // Puedes hacerlo dinámico después
      fontFooter, 
      8.5, 
      10
    );

    // ========================================================================
    // 5. SELLO DE DOBLE VÍA: VÍA 1 (PIE DE PÁGINA EN TODAS LAS HOJAS)
    // ========================================================================
    const totalPaginas = paginas.length;
    paginas.forEach((pag, idx) => {
      const yFooter = 35;

      pag.drawLine({
        start: { x: marginLeft, y: yFooter + 10 },
        end: { x: pageWidth - marginRight, y: yFooter + 10 },
        thickness: 0.4,
        color: rgb(0.7, 0.75, 0.8),
      });

      const textoIzquierda = this.sanitizarTextoWinAnsi(
        `/${resolucion.inicialesOperador}   |   ${selloControl}`,
      );
      pag.drawText(textoIzquierda, {
        x: marginLeft,
        y: yFooter,
        size: 7.5,
        font: fontFooter,
        color: rgb(0.3, 0.35, 0.4),
      });

      const textoDerecha = `Pag. ${idx + 1} de ${totalPaginas}`;
      const anchoDer = fontFooter.widthOfTextAtSize(textoDerecha, 7.5);
      pag.drawText(textoDerecha, {
        x: pageWidth - marginRight - anchoDer,
        y: yFooter,
        size: 7.5,
        font: fontFooter,
        color: rgb(0.3, 0.35, 0.4),
      });
    });

    // ========================================================================
    // 6. SELLO DE DOBLE VÍA: VÍA 2 (METADATOS INTERNOS DEL DICCIONARIO PDF)
    // ========================================================================
    pdfDoc.setTitle(`${denominacionSerie} N.° ${resolucion.numeroCompleto}`);
    pdfDoc.setAuthor(`${universidad} - ${facultad}`);
    pdfDoc.setSubject(selloControl);
    pdfDoc.setKeywords([
      'FCSa-UAC',
      resolucion.idTramiteControl,
      `VER-${resolucion.versionPdf}`,
      `HASH-${resolucion.hashVersionGenerado}`,
      resolucion.numeroCompleto,
    ]);
    pdfDoc.setProducer('Sistema de Resoluciones de Titulacion FCSa-UAC (NestJS + pdf-lib)');
    pdfDoc.setCreationDate(new Date());

    const pdfBytes = await pdfDoc.save();
    const bufferFinal = Buffer.from(pdfBytes);
    const nombreArchivo = `${resolucion.numeroCompleto}_v${resolucion.versionPdf}.pdf`;

    return {
      buffer: bufferFinal,
      nombreArchivo,
      selloControl,
    };
  }

  /**
   * Inspecciona en JSON el Sello de Doble Vía incrustado en el PDF generado.
   */
  async inspeccionarMetadatosPdfGenerado(resolucionId: string) {
    const { buffer, nombreArchivo, selloControl } = await this.generarPdfResolucion(resolucionId);
    const pdfDoc = await PDFDocument.load(buffer);

    return {
      nombreArchivo,
      tamanoBytes: buffer.length,
      selloDobleViaEsperado: selloControl,
      metadatosIncrustados: {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        keywords: pdfDoc.getKeywords(),
        producer: pdfDoc.getProducer(),
      },
    };
  }
}