// Ruta: apps/documentos-service/src/pdf/pdf-generator.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import {
  ResolucionTemplatesService,
  SeccionesJuridicasResult,
  SerieNumeracion,
} from '../templates/resolucion-templates.service';
import type { ConfiguracionInstitucionalDto } from '../clients/identidad.client';
import type { ResolucionRemotaDto } from '../clients/titulacion.client';

interface SegmentoTexto {
  texto: string;
  negrita?: boolean;
  cursiva?: boolean;
}

interface FragmentoPalabra {
  texto: string;
  font: PDFFont;
  ancho: number;
}

interface PalabraToken {
  fragmentos: FragmentoPalabra[];
  ancho: number;
}

interface EscalaTipografica {
  bodySize: number;
  lineHeight: number;
  paragraphSpacing: number;
  headerUniSize: number;
  headerFacSize: number;
  titleResSize: number;
  signatureBlockHeight: number;
  closingSpacing: number;
  firstLineIndent: number;
  articleLabelWidth: number;
}

export interface PdfGeneradoResult {
  buffer: Buffer;
  nombreArchivo: string;
  selloControl: string;
}

@Injectable()
export class PdfGeneratorService {
  private readonly headerImagePath = process.env.PDF_HEADER_IMAGE_PATH
    ? join(process.cwd(), process.env.PDF_HEADER_IMAGE_PATH)
    : join(process.cwd(), 'apps', 'documentos-service', 'assets', 'header.jpg');

  private readonly footerImagePath = process.env.PDF_FOOTER_IMAGE_PATH
    ? join(process.cwd(), process.env.PDF_FOOTER_IMAGE_PATH)
    : join(process.cwd(), 'apps', 'documentos-service', 'assets', 'footer.jpg');

  private readonly fontsDirPath = join(
    process.cwd(),
    'apps',
    'documentos-service',
    'assets',
    'fonts',
  );

  private readonly pageWidth = 595.28;
  private readonly pageHeight = 841.89;
  private readonly marginLeft = 62;
  private readonly marginRight = 62;
  private readonly marginTop = 62;
  private readonly marginBottom = 78;
  private readonly contentWidth =
    this.pageWidth - this.marginLeft - this.marginRight;

  constructor(
    private readonly templatesService: ResolucionTemplatesService,
  ) {}

  private async cargarImagen(pdfDoc: PDFDocument, ruta: string): Promise<any> {
    if (!fs.existsSync(ruta)) return null;
    const bytes = fs.readFileSync(ruta);
    if (bytes.length < 4) return null;
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return await pdfDoc.embedPng(bytes);
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return await pdfDoc.embedJpg(bytes);
    }
    return null;
  }

    private async cargarFuentesDocumento(pdfDoc: PDFDocument): Promise<{
    fontRegular: PDFFont;
    fontBold: PDFFont;
    fontItalic: PDFFont;
    fontBoldItalic: PDFFont;
    fontFooter: PDFFont;
  }> {
    const calibriRegPath = join(this.fontsDirPath, 'calibri.ttf');
    const calibriBoldPath = join(this.fontsDirPath, 'calibrib.ttf');
    const calibriItalicPath = join(this.fontsDirPath, 'calibrii.ttf');
    const calibriBoldItalicPath = join(this.fontsDirPath, 'calibriz.ttf');

    if (
      fs.existsSync(calibriRegPath) &&
      fs.existsSync(calibriBoldPath) &&
      fs.existsSync(calibriItalicPath)
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fontkit = require('@pdf-lib/fontkit');
        pdfDoc.registerFontkit(fontkit);

        // Desactivar ligaduras OpenType (ti, tt, fi, fl) y activar subsetting:
        // evita el bug de pdf-lib/fontkit donde las ligaduras de Calibri quedan sin ancho en /W y superponen letras.
        const embedOpts = {
          subset: true,
          features: {
            liga: false,
            calt: false,
            clig: false,
            dlig: false,
            rlig: false,
          },
        };

        const fontRegular = await pdfDoc.embedFont(
          fs.readFileSync(calibriRegPath),
          embedOpts,
        );
        const fontBold = await pdfDoc.embedFont(
          fs.readFileSync(calibriBoldPath),
          embedOpts,
        );
        const fontItalic = await pdfDoc.embedFont(
          fs.readFileSync(calibriItalicPath),
          embedOpts,
        );
        const fontBoldItalic = fs.existsSync(calibriBoldItalicPath)
          ? await pdfDoc.embedFont(
              fs.readFileSync(calibriBoldItalicPath),
              embedOpts,
            )
          : fontBold;

        return {
          fontRegular,
          fontBold,
          fontItalic,
          fontBoldItalic,
          fontFooter: fontRegular,
        };
      } catch (error: any) {
        console.warn(
          '⚠️ No se pudo cargar Calibri (fontkit). Usando Helvetica como respaldo.',
          error.message,
        );
      }
    }

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(
      StandardFonts.HelveticaBoldOblique,
    );

    return {
      fontRegular,
      fontBold,
      fontItalic,
      fontBoldItalic,
      fontFooter: fontRegular,
    };
  }

  private construirEscala(bodySize: number): EscalaTipografica {
    const ratio = bodySize / 9.6;
    // Al compactar para ajustar a 1 página, también ajustamos suavemente interlineado y espacios sin perder legibilidad
    const lineHeightFactor = Math.max(1.14, 1.24 - (9.6 - bodySize) * 0.042);
    return {
      bodySize,
      lineHeight: Number((bodySize * lineHeightFactor).toFixed(2)),
      paragraphSpacing: Math.max(2.6, Number((5.2 * Math.pow(ratio, 1.45)).toFixed(2))),
      headerUniSize: Number((11.6 * ratio).toFixed(2)),
      headerFacSize: Number((10.6 * ratio).toFixed(2)),
      titleResSize: Number((10.6 * ratio).toFixed(2)),
      signatureBlockHeight: Math.round(74 * ratio),
      closingSpacing: Math.max(8, Math.round(13 * ratio)),
      firstLineIndent: Math.round(30 * ratio),
      articleLabelWidth: Math.round(74 * ratio),
    };
  }

  private sanitizarFragmentoPreservandoEspacios(texto: string): string {
    if (!texto) return '';
    return texto
      .replace(/[“”«»]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...');
  }

  private parsearTextoConFormato(
    texto: string,
    cursivaBase = false,
  ): SegmentoTexto[] {
    if (!texto) return [];
    const partes = texto.split(/(\*\*[\s\S]*?\*\*)/g).filter(Boolean);
    return partes.map((parte) => {
      if (parte.startsWith('**') && parte.endsWith('**') && parte.length >= 4) {
        return {
          texto: parte.slice(2, -2),
          negrita: true,
          cursiva: cursivaBase,
        };
      }
      return {
        texto: parte,
        negrita: false,
        cursiva: cursivaBase,
      };
    });
  }

  private dividirPalabraMuyLarga(
    token: PalabraToken,
    size: number,
    limiteAncho: number,
  ): PalabraToken[] {
    if (token.ancho <= limiteAncho || limiteAncho <= 20) return [token];

    const partes: PalabraToken[] = [];
    let actual: FragmentoPalabra[] = [];
    let anchoActual = 0;

    for (const frag of token.fragmentos) {
      let buffer = '';
      for (const ch of frag.texto) {
        const candidato = buffer + ch;
        const anchoCandidato = frag.font.widthOfTextAtSize(candidato, size);
        if (
          anchoActual + anchoCandidato > limiteAncho &&
          (actual.length > 0 || buffer.length > 0)
        ) {
          if (buffer.length > 0) {
            const anchoBuf = frag.font.widthOfTextAtSize(buffer, size);
            actual.push({ texto: buffer, font: frag.font, ancho: anchoBuf });
            anchoActual += anchoBuf;
          }
          partes.push({ fragmentos: actual, ancho: anchoActual });
          actual = [];
          anchoActual = 0;
          buffer = ch;
        } else {
          buffer = candidato;
        }
      }
      if (buffer.length > 0) {
        const anchoBuf = frag.font.widthOfTextAtSize(buffer, size);
        actual.push({ texto: buffer, font: frag.font, ancho: anchoBuf });
        anchoActual += anchoBuf;
      }
    }

    if (actual.length > 0) {
      partes.push({ fragmentos: actual, ancho: anchoActual });
    }
    return partes.length > 0 ? partes : [token];
  }

  private envolverSegmentosEnLineas(
    segmentos: SegmentoTexto[],
    size: number,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    fontItalic: PDFFont,
    fontBoldItalic: PDFFont,
    anchoMaximoBloque: number,
    sangriaPrimeraLinea = 0,
  ): PalabraToken[][][] {
    const bloquesDeLinea: PalabraToken[][] = [[]];
    let palabraActual: FragmentoPalabra[] = [];
    let anchoPalabraActual = 0;

    const cerrarPalabraActual = () => {
      if (palabraActual.length > 0) {
        bloquesDeLinea[bloquesDeLinea.length - 1].push({
          fragmentos: palabraActual,
          ancho: anchoPalabraActual,
        });
        palabraActual = [];
        anchoPalabraActual = 0;
      }
    };

    for (const seg of segmentos) {
      const font =
        seg.negrita && seg.cursiva
          ? fontBoldItalic
          : seg.negrita
            ? fontBold
            : seg.cursiva
              ? fontItalic
              : fontRegular;

      // Dividir en saltos de línea ANTES de sanitizar para preservar \n reales (Jurado, DICE/DEBE DECIR)
      const subLineas = seg.texto.split(/\r?\n/);

      subLineas.forEach((subLinea, idxSub) => {
        if (idxSub > 0) {
          cerrarPalabraActual();
          bloquesDeLinea.push([]);
        }
        const limpia = this.sanitizarFragmentoPreservandoEspacios(subLinea);
        const piezas = limpia.split(/([ \t]+)/);

        for (const pieza of piezas) {
          if (!pieza) continue;
          if (/^[ \t]+$/.test(pieza)) {
            cerrarPalabraActual();
          } else {
            const anchoPieza = font.widthOfTextAtSize(pieza, size);
            palabraActual.push({
              texto: pieza,
              font,
              ancho: anchoPieza,
            });
            anchoPalabraActual += anchoPieza;
          }
        }
      });
    }
    cerrarPalabraActual();

    const anchoEspacioBase = fontRegular.widthOfTextAtSize(' ', size);
    const resultadoPorBloque: PalabraToken[][][] = [];

    for (const bloquePalabras of bloquesDeLinea) {
      if (bloquePalabras.length === 0) {
        resultadoPorBloque.push([]);
        continue;
      }

      const lineasEnvueltas: PalabraToken[][] = [];
      let lineaActual: PalabraToken[] = [];
      let anchoAcumulado = 0;

      for (const tokenOriginal of bloquePalabras) {
        const esPrimeraLinea = lineasEnvueltas.length === 0;
        const limiteAnchoActual = Math.max(
          40,
          esPrimeraLinea
            ? anchoMaximoBloque - sangriaPrimeraLinea
            : anchoMaximoBloque,
        );

        const subTokens = this.dividirPalabraMuyLarga(
          tokenOriginal,
          size,
          limiteAnchoActual,
        );

        for (const token of subTokens) {
          const esPrimera = lineasEnvueltas.length === 0;
          const limiteActual = Math.max(
            40,
            esPrimera
              ? anchoMaximoBloque - sangriaPrimeraLinea
              : anchoMaximoBloque,
          );

          const espacioNecesario =
            lineaActual.length === 0
              ? token.ancho
              : anchoEspacioBase + token.ancho;

          if (
            anchoAcumulado + espacioNecesario <= limiteActual ||
            lineaActual.length === 0
          ) {
            lineaActual.push(token);
            anchoAcumulado += espacioNecesario;
          } else {
            lineasEnvueltas.push(lineaActual);
            lineaActual = [token];
            anchoAcumulado = token.ancho;
          }
        }
      }

      if (lineaActual.length > 0) lineasEnvueltas.push(lineaActual);
      resultadoPorBloque.push(lineasEnvueltas);
    }

    return resultadoPorBloque;
  }

  async generarPdf(params: {
    resolucion: ResolucionRemotaDto;
    configuracion: ConfiguracionInstitucionalDto;
    nombreDecanoVigente?: string | null;
    inicialesDecanoVigente?: string | null;
  }): Promise<PdfGeneradoResult> {
    const {
      resolucion,
      configuracion,
      inicialesDecanoVigente,
    } = params;

    const codigoExpediente =
      resolucion.expediente?.codigoExpediente || 'EXP-S/N';
    const universidad = this.templatesService.sanitizarTextoWinAnsi(
      (
        configuracion?.universidad || 'UNIVERSIDAD ANDINA DEL CUSCO'
      ).toUpperCase(),
    );
    const facultad = this.templatesService.sanitizarTextoWinAnsi(
      (
        configuracion?.facultad || 'FACULTAD DE CIENCIAS DE LA SALUD'
      ).toUpperCase(),
    );
    const ciudad = this.templatesService.sanitizarTextoWinAnsi(
      configuracion?.ciudad || 'Cusco',
    );

    const datosEspecificos =
      (resolucion.datosEspecificos as Record<string, any>) || {};
    const secciones: SeccionesJuridicasResult =
      this.templatesService.construirSeccionesJuridicas(
        resolucion.tipo,
        datosEspecificos,
        codigoExpediente,
      );

    const selloControl = `ID-TRAMITE: ${resolucion.idTramiteControl} | VER: ${resolucion.versionPdf} | HASH: ${resolucion.hashVersionGenerado}`;

    const pdfDoc = await PDFDocument.create();
    const {
      fontRegular,
      fontBold,
      fontItalic,
      fontBoldItalic,
      fontFooter,
    } = await this.cargarFuentesDocumento(pdfDoc);

    let headerImage: any = null;
    let headerImageHeight = 0;
    try {
      headerImage = await this.cargarImagen(pdfDoc, this.headerImagePath);
      if (headerImage) {
        const imgDims = headerImage.scale(1);
        const imgWidth = this.pageWidth;
        headerImageHeight = (imgDims.height / imgDims.width) * imgWidth;
      }
    } catch (error: any) {
      console.error(
        '❌ Error al cargar la imagen del encabezado:',
        error.message,
      );
    }

    let footerImage: any = null;
    let footerImageHeight = 0;
    try {
      footerImage = await this.cargarImagen(pdfDoc, this.footerImagePath);
      if (footerImage) {
        const imgDims = footerImage.scale(1);
        const imgWidth = this.pageWidth;
        footerImageHeight = (imgDims.height / imgDims.width) * imgWidth;
      }
    } catch (error: any) {
      console.error(
        '❌ Error al cargar la imagen del pie de página:',
        error.message,
      );
    }

    // Margen inferior real garantizando separación limpia sobre el pie de página
    const margenInferiorSeguro = Math.max(
      this.marginBottom,
      Math.ceil(footerImageHeight) + 12,
    );

    const serieTexto = resolucion.serie === SerieNumeracion.CF ? ' - CF' : '';
    const tituloResolucionTexto = `RESOLUCIÓN Nº ${resolucion.numeroCorrelativo} - ${resolucion.anioNumeracion}${serieTexto} - FCSa - UAC`;
    const fechaEmisionFormateada = `${ciudad}, ${this.templatesService.formatearFechaLargaCastellano(resolucion.fechaEmision)}`;
    const inicialesDecano = (inicialesDecanoVigente || 'JAAFD').toUpperCase();
    const inicialesOperador = (
      resolucion.inicialesOperador || 'avc'
    ).toLowerCase();
    const lineasDistribucion = [
      `FCSa/ ${inicialesDecano}/${inicialesOperador}`,
      'Interesado (a)',
      'Jurados',
      'Asesor (a)',
      'Expediente (1)',
      'Archivo (1).',
    ];

    const paginas: PDFPage[] = [];

    // Motor unificado de maquetación: permite simular (dibujar = false) con matemática 100% exacta
    // para ajustar automáticamente a 1 sola página A4 cuando sea legible, y luego dibujar (dibujar = true).
    const renderizarDocumento = (bodySize: number, dibujar: boolean): number => {
      const escala = this.construirEscala(bodySize);
      const ratio = bodySize / 9.6;
      const gapSeccion = Math.max(2, Number((4 * ratio).toFixed(2)));
      const gapEncabezadoP1 = Math.max(17, Math.round(22 * ratio));
      const gapEncabezadoP2 = Math.max(22, Math.round(26 * ratio));

      let numPaginas = 0;
      const estado: { paginaActual: PDFPage | null } = { paginaActual: null };

      const iniciarPagina = (esPrimeraPagina: boolean): number => {
        numPaginas += 1;
        if (dibujar) {
          const nuevaPagina = pdfDoc.addPage([this.pageWidth, this.pageHeight]);
          estado.paginaActual = nuevaPagina;
          paginas.push(nuevaPagina);
          if (headerImage) {
            nuevaPagina.drawImage(headerImage, {
              x: 0,
              y: this.pageHeight - headerImageHeight,
              width: this.pageWidth,
              height: headerImageHeight,
            });
          }
        }
        if (headerImage) {
          const separacionSuperior = esPrimeraPagina
            ? gapEncabezadoP1
            : gapEncabezadoP2;
          return this.pageHeight - headerImageHeight - separacionSuperior;
        }
        return this.pageHeight - this.marginTop;
      };

      let cursorY = iniciarPagina(true);

      const verificarEspacioOSaltarPagina = (altoRequerido: number) => {
        if (cursorY - altoRequerido < margenInferiorSeguro) {
          cursorY = iniciarPagina(false);
        }
      };

      const dibujarTextoCentrado = (
        texto: string,
        font: PDFFont,
        size: number,
        espacioInferior: number,
        subrayado = false,
        color: any = rgb(0.05, 0.05, 0.05),
      ) => {
        const textoLimpio = this.templatesService
          .sanitizarTextoWinAnsi(texto)
          .replace(/\s+/g, ' ')
          .trim();
        let sizeEfectivo = size;
        let textWidth = font.widthOfTextAtSize(textoLimpio, sizeEfectivo);
        if (textWidth > this.contentWidth && textWidth > 0) {
          sizeEfectivo = Number(
            ((sizeEfectivo * this.contentWidth) / textWidth).toFixed(2),
          );
          textWidth = font.widthOfTextAtSize(textoLimpio, sizeEfectivo);
        }

        verificarEspacioOSaltarPagina(sizeEfectivo + espacioInferior);
        if (dibujar && estado.paginaActual) {
          const x = this.marginLeft + (this.contentWidth - textWidth) / 2;
          estado.paginaActual.drawText(textoLimpio, {
            x,
            y: cursorY,
            size: sizeEfectivo,
            font,
            color,
          });
          if (subrayado) {
            estado.paginaActual.drawLine({
              start: { x, y: cursorY - 2 },
              end: { x: x + textWidth, y: cursorY - 2 },
              thickness: 0.75,
              color,
            });
          }
        }
        cursorY -= sizeEfectivo + espacioInferior;
      };

      const dibujarTextoDerecha = (
        texto: string,
        font: PDFFont,
        size: number,
        espacioInferior: number,
      ) => {
        const textoLimpio = this.templatesService
          .sanitizarTextoWinAnsi(texto)
          .replace(/\s+/g, ' ')
          .trim();
        verificarEspacioOSaltarPagina(size + espacioInferior);
        if (dibujar && estado.paginaActual) {
          const textWidth = font.widthOfTextAtSize(textoLimpio, size);
          const x = Math.max(
            this.marginLeft,
            this.pageWidth - this.marginRight - textWidth,
          );
          estado.paginaActual.drawText(textoLimpio, {
            x,
            y: cursorY,
            size,
            font,
            color: rgb(0.05, 0.05, 0.05),
          });
        }
        cursorY -= size + espacioInferior;
      };

      const dibujarParrafoCompuesto = (
        segmentos: SegmentoTexto[],
        opciones?: {
          size?: number;
          lineHeight?: number;
          espacioInferior?: number;
          justificar?: boolean;
          sangriaPrimeraLinea?: number;
          offsetIzquierdo?: number;
          etiquetaColumnaIzquierda?: string;
        },
      ) => {
        const size = opciones?.size ?? escala.bodySize;
        const lineHeight = opciones?.lineHeight ?? escala.lineHeight;
        const espacioInferior =
          opciones?.espacioInferior ?? escala.paragraphSpacing;
        const justificar = opciones?.justificar ?? true;
        const sangriaPrimeraLinea = opciones?.sangriaPrimeraLinea ?? 0;
        const etiquetaIzquierda = opciones?.etiquetaColumnaIzquierda;

        let offsetIzquierdo = opciones?.offsetIzquierdo ?? 0;
        let etiquetaLimpia = '';
        let labelWidth = 0;
        if (etiquetaIzquierda) {
          etiquetaLimpia =
            this.templatesService.sanitizarTextoWinAnsi(etiquetaIzquierda);
          labelWidth = fontBold.widthOfTextAtSize(etiquetaLimpia, size);
          offsetIzquierdo = Math.max(
            offsetIzquierdo,
            Math.ceil(labelWidth + 12),
          );
        }

        const anchoDisponibleBloque = this.contentWidth - offsetIzquierdo;
        const bloquesEnvueltos = this.envolverSegmentosEnLineas(
          segmentos,
          size,
          fontRegular,
          fontBold,
          fontItalic,
          fontBoldItalic,
          anchoDisponibleBloque,
          sangriaPrimeraLinea,
        );
        const anchoEspacioBase = fontRegular.widthOfTextAtSize(' ', size);

        let etiquetaDibujada = false;

        for (const lineasEnvueltas of bloquesEnvueltos) {
          if (lineasEnvueltas.length === 0) {
            cursorY -= lineHeight * 0.5;
            continue;
          }

          lineasEnvueltas.forEach((linea, idxLinea) => {
            verificarEspacioOSaltarPagina(lineHeight);

            if (etiquetaIzquierda && !etiquetaDibujada && idxLinea === 0) {
              if (dibujar && estado.paginaActual) {
                estado.paginaActual.drawText(etiquetaLimpia, {
                  x: this.marginLeft,
                  y: cursorY,
                  size,
                  font: fontBold,
                  color: rgb(0.05, 0.05, 0.05),
                });

                estado.paginaActual.drawLine({
                  start: { x: this.marginLeft, y: cursorY - 1.5 },
                  end: { x: this.marginLeft + labelWidth, y: cursorY - 1.5 },
                  thickness: 0.75,
                  color: rgb(0.05, 0.05, 0.05),
                });
              }
              etiquetaDibujada = true;
            }

            if (dibujar && estado.paginaActual) {
              const esPrimeraLineaDelBloque = idxLinea === 0;
              const esUltimaLineaDelBloque =
                idxLinea === lineasEnvueltas.length - 1;
              const sangriaLineaActual = esPrimeraLineaDelBloque
                ? sangriaPrimeraLinea
                : 0;
              const anchoLineaMax = anchoDisponibleBloque - sangriaLineaActual;

              const totalAnchoPalabras = linea.reduce(
                (acc, t) => acc + t.ancho,
                0,
              );
              let espacioEntrePalabras = anchoEspacioBase;
              if (justificar && !esUltimaLineaDelBloque && linea.length > 1) {
                const espacioDisponible = anchoLineaMax - totalAnchoPalabras;
                const espacioCalculado =
                  espacioDisponible / (linea.length - 1);

                if (espacioCalculado > anchoEspacioBase) {
                  espacioEntrePalabras = Math.min(
                    espacioCalculado,
                    anchoEspacioBase * 3.0,
                  );
                } else {
                  espacioEntrePalabras = anchoEspacioBase;
                }
              }

              let x = this.marginLeft + offsetIzquierdo + sangriaLineaActual;
              for (const token of linea) {
                let xFrag = x;
                for (const frag of token.fragmentos) {
                  estado.paginaActual.drawText(frag.texto, {
                    x: xFrag,
                    y: cursorY,
                    size,
                    font: frag.font,
                    color: rgb(0.05, 0.05, 0.05),
                  });
                  xFrag += frag.ancho;
                }
                x += token.ancho + espacioEntrePalabras;
              }
            }
            cursorY -= lineHeight;
          });
        }
        cursorY -= espacioInferior;
      };

      // 1. ENCABEZADO Y FACULTAD DEBAJO
      if (!headerImage) {
        dibujarTextoCentrado(
          universidad,
          fontBold,
          escala.headerUniSize,
          Math.max(3, Math.round(4 * ratio)),
        );
      }

      dibujarTextoCentrado(
        facultad,
        fontBold,
        Number((escala.headerFacSize + 3.0 * ratio).toFixed(2)),
        Math.max(5, Number((8.5 * ratio).toFixed(2))),
        false,
        rgb(0.1, 0.45, 0.75),
      );

      // 2. TÍTULO DE LA RESOLUCIÓN Y FECHA
      dibujarTextoCentrado(
        tituloResolucionTexto,
        fontBold,
        Number((escala.titleResSize + 3.2 * ratio).toFixed(2)),
        Math.max(6, Number((10 * ratio).toFixed(2))),
        true,
      );

      dibujarTextoDerecha(
        fechaEmisionFormateada,
        fontBold,
        Number((escala.bodySize + 0.9 * ratio).toFixed(2)),
        Math.max(5, Number((9 * ratio).toFixed(2))),
      );

      // Línea de autoridad
      dibujarParrafoCompuesto(
        [
          {
            texto:
              'EL DECANO DE LA FACULTAD DE CIENCIAS DE LA SALUD DE LA UNIVERSIDAD ANDINA DEL CUSCO:',
            negrita: true,
          },
        ],
        {
          size: Number((escala.bodySize + 0.7 * ratio).toFixed(2)),
          lineHeight: Number(
            ((escala.bodySize + 0.7 * ratio) * 1.24).toFixed(2),
          ),
          espacioInferior: Math.max(5, Number((8 * ratio).toFixed(2))),
          justificar: false,
        },
      );

      // FUNCIÓN AUXILIAR PARA TÍTULOS DE SECCIÓN
      const dibujarTituloSeccion = (texto: string) => {
        const textoLimpio = this.templatesService.sanitizarTextoWinAnsi(texto);
        const fontSize = Number((escala.bodySize + 1.1 * ratio).toFixed(2));
        const espacioPostTitulo = Math.max(3, Number((4.5 * ratio).toFixed(2)));

        verificarEspacioOSaltarPagina(
          fontSize + espacioPostTitulo + escala.lineHeight * 2,
        );
        if (dibujar && estado.paginaActual) {
          const x = this.marginLeft + escala.firstLineIndent;
          const textWidth = fontBold.widthOfTextAtSize(textoLimpio, fontSize);

          estado.paginaActual.drawText(textoLimpio, {
            x,
            y: cursorY,
            size: fontSize,
            font: fontBold,
            color: rgb(0.05, 0.05, 0.05),
          });

          estado.paginaActual.drawLine({
            start: { x, y: cursorY - 1.5 },
            end: { x: x + textWidth, y: cursorY - 1.5 },
            thickness: 0.75,
            color: rgb(0.05, 0.05, 0.05),
          });
        }

        cursorY -= fontSize + espacioPostTitulo;
      };

      // 4. SECCIÓN VISTO
      dibujarTituloSeccion('VISTO:');
      dibujarParrafoCompuesto(this.parsearTextoConFormato(secciones.visto), {
        sangriaPrimeraLinea: escala.firstLineIndent,
      });

      cursorY -= gapSeccion;

      // 5. SECCIÓN CONSIDERANDO
      dibujarTituloSeccion('CONSIDERANDO:');
      for (const parrafo of secciones.considerando) {
        dibujarParrafoCompuesto(this.parsearTextoConFormato(parrafo), {
          sangriaPrimeraLinea: escala.firstLineIndent,
        });
      }

      cursorY -= gapSeccion;

      // 6. SECCIÓN RESUELVE
      dibujarTituloSeccion('RESUELVE:');
      for (const art of secciones.articulosResolutivos) {
        dibujarParrafoCompuesto(this.parsearTextoConFormato(art.texto), {
          offsetIzquierdo: escala.articleLabelWidth,
          etiquetaColumnaIzquierda: art.titulo,
        });
      }

      // 7. CIERRE Y BLOQUE DE DISTRIBUCIÓN
      const pasoIniciales = Math.max(8, Number((10 * ratio).toFixed(2)));
      const pasoDist = Math.max(7, Number((8.4 * ratio).toFixed(2)));
      const saltoPostReg = Math.max(9, Number((11 * ratio).toFixed(2)));
      const alturaBloqueCierre =
        gapSeccion + saltoPostReg + pasoIniciales + 5 * pasoDist + 4;
      verificarEspacioOSaltarPagina(alturaBloqueCierre);
      cursorY -= gapSeccion;

      const fontSizeReg = Number((escala.bodySize + 0.4 * ratio).toFixed(2));
      const textoRegistrese = 'Regístrese, Comuníquese y Archívese. ';

      if (dibujar && estado.paginaActual) {
        estado.paginaActual.drawText(
          this.templatesService.sanitizarTextoWinAnsi(textoRegistrese),
          {
            x: this.marginLeft,
            y: cursorY,
            size: fontSizeReg,
            font: fontBold,
            color: rgb(0.05, 0.05, 0.05),
          },
        );

        const anchoTextoReg = fontBold.widthOfTextAtSize(
          textoRegistrese,
          fontSizeReg,
        );
        const anchoGuionConEspacio = fontBold.widthOfTextAtSize(
          '- ',
          fontSizeReg,
        );
        const anchoDisponible = this.contentWidth - anchoTextoReg;
        const cantidadGuiones = Math.max(
          0,
          Math.floor(anchoDisponible / anchoGuionConEspacio),
        );

        if (cantidadGuiones > 0) {
          estado.paginaActual.drawText('- '.repeat(cantidadGuiones), {
            x: this.marginLeft + anchoTextoReg,
            y: cursorY,
            size: fontSizeReg,
            font: fontBold,
            color: rgb(0.05, 0.05, 0.05),
          });
        }
      }

      cursorY -= saltoPostReg;

      const sizeIniciales = Math.max(7.4, Number((8.6 * ratio).toFixed(2)));
      const sizeDist = Math.max(6.6, Number((7.5 * ratio).toFixed(2)));

      lineasDistribucion.forEach((lineaDist, index) => {
        if (dibujar && estado.paginaActual) {
          estado.paginaActual.drawText(
            this.templatesService.sanitizarTextoWinAnsi(lineaDist),
            {
              x: this.marginLeft,
              y: cursorY,
              size: index === 0 ? sizeIniciales : sizeDist,
              font: fontBold,
              color: rgb(0.05, 0.05, 0.05),
            },
          );
        }
        cursorY -= index === 0 ? pasoIniciales : pasoDist;
      });

      return numPaginas;
    };

    // AUTO-AJUSTE A 1 SOLA PÁGINA:
    // Prueba desde tamaño normal (9.6pt) bajando gradualmente hasta el piso legible (7.3pt).
    // Si aun en 7.3pt no cabe en 1 página (resolución excepcionalmente extensa),
    // usa 9.2pt en 2 páginas limpias para priorizar la legibilidad.
    const escalasCandidatas = [9.6, 9.2, 8.8, 8.4, 8.0, 7.6, 7.3];
    let bodySizeElegido = 9.2;
    for (const candidato of escalasCandidatas) {
      if (renderizarDocumento(candidato, false) === 1) {
        bodySizeElegido = candidato;
        break;
      }
    }

    renderizarDocumento(bodySizeElegido, true);

    // 9. PIE DE PÁGINA INSTITUCIONAL Y SELLO 100% INVISIBLE EN (0,0)
    const selloInvisibleLimpio =
      this.templatesService.sanitizarTextoWinAnsi(selloControl);

    for (const pag of paginas) {
      if (footerImage) {
        pag.drawImage(footerImage, {
          x: 0,
          y: 0,
          width: this.pageWidth,
          height: footerImageHeight,
        });
      }

      pag.drawText(selloInvisibleLimpio, {
        x: 0,
        y: 0,
        size: 0.1,
        font: fontFooter,
        color: rgb(1, 1, 1),
      });
    }

    // 10. METADATOS INTERNOS DEL DICCIONARIO PDF
    pdfDoc.setTitle(tituloResolucionTexto);
    pdfDoc.setAuthor(`${universidad} - ${facultad}`);
    pdfDoc.setSubject(selloControl);
    pdfDoc.setKeywords([
      'FCSa-UAC',
      resolucion.idTramiteControl,
      `VER-${resolucion.versionPdf}`,
      `HASH-${resolucion.hashVersionGenerado}`,
      resolucion.numeroCompleto,
    ]);
    pdfDoc.setProducer(
      'Sistema de Resoluciones de Titulacion FCSa-UAC (NestJS + pdf-lib)',
    );
    pdfDoc.setCreationDate(new Date());

    const pdfBytes = await pdfDoc.save();
    const bufferFinal = Buffer.from(pdfBytes);
    const nombreArchivo = `${resolucion.numeroCompleto}_v${resolucion.versionPdf}.pdf`;

    return { buffer: bufferFinal, nombreArchivo, selloControl };
  }

  async extraerMetadatosBuffer(
    buffer: Buffer,
    nombreArchivo: string,
    selloControl: string,
  ) {
    const pdfDoc = await PDFDocument.load(buffer);
    return {
      nombreArchivo,
      tamanoBytes: buffer.length,
      selloControlEsperado: selloControl,
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