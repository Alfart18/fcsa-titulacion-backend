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

interface PalabraToken {
  palabra: string;
  font: PDFFont;
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
  private readonly marginRight = 58;
  private readonly marginTop = 0;
  private readonly marginBottom = 68;
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

        const fontRegular = await pdfDoc.embedFont(
          fs.readFileSync(calibriRegPath),
        );
        const fontBold = await pdfDoc.embedFont(
          fs.readFileSync(calibriBoldPath),
        );
        const fontItalic = await pdfDoc.embedFont(
          fs.readFileSync(calibriItalicPath),
        );
        const fontBoldItalic = fs.existsSync(calibriBoldItalicPath)
          ? await pdfDoc.embedFont(fs.readFileSync(calibriBoldItalicPath))
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
    const ratio = bodySize / 10;
    return {
      bodySize,
      lineHeight: Number((bodySize * 1.22).toFixed(2)),
      paragraphSpacing: Math.max(4, Math.round(6 * ratio)),
      headerUniSize: Number((12 * ratio).toFixed(2)),
      headerFacSize: Number((11 * ratio).toFixed(2)),
      titleResSize: Number((11 * ratio).toFixed(2)),
      signatureBlockHeight: Math.round(65 * ratio),
      closingSpacing: Math.max(12, Math.round(18 * ratio)),
      firstLineIndent: Math.round(35 * ratio),
      articleLabelWidth: Math.round(78 * ratio),
    };
  }

  private parsearTextoConFormato(
    texto: string,
    cursivaBase = false,
  ): SegmentoTexto[] {
    if (!texto) return [];
    const partes = texto.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    return partes.map((parte) => {
      if (parte.startsWith('**') && parte.endsWith('**')) {
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

  private envolverSegmentosEnLineas(
    segmentos: SegmentoTexto[],
    size: number,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    fontItalic: PDFFont,
    anchoMaximoBloque: number,
    sangriaPrimeraLinea = 0,
  ): PalabraToken[][][] {
    const bloquesDeLinea: PalabraToken[][] = [[]];

    for (const seg of segmentos) {
      const font = seg.negrita
        ? fontBold
        : seg.cursiva
          ? fontItalic
          : fontRegular;
      const limpio = this.templatesService.sanitizarTextoWinAnsi(seg.texto);
      const subLineas = limpio.split('\n');

      subLineas.forEach((subLinea, idxSub) => {
        if (idxSub > 0) bloquesDeLinea.push([]);
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
    const resultadoPorBloque: PalabraToken[][][] = [];

    for (const bloquePalabras of bloquesDeLinea) {
      if (bloquePalabras.length === 0) {
        resultadoPorBloque.push([]);
        continue;
      }

      const lineasEnvueltas: PalabraToken[][] = [];
      let lineaActual: PalabraToken[] = [];
      let anchoAcumulado = 0;

      for (const token of bloquePalabras) {
        const esPrimeraLinea = lineasEnvueltas.length === 0;
        const limiteAnchoActual = esPrimeraLinea
          ? anchoMaximoBloque - sangriaPrimeraLinea
          : anchoMaximoBloque;

        const espacioNecesario =
          lineaActual.length === 0
            ? token.ancho
            : anchoEspacioBase + token.ancho;

        if (
          anchoAcumulado + espacioNecesario <= limiteAnchoActual ||
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

    const escala = this.construirEscala(9.8);

    const paginas: PDFPage[] = [];
    let paginaActual = pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    paginas.push(paginaActual);
    let cursorY = this.pageHeight - this.marginTop;

    const verificarEspacioOSaltarPagina = (altoRequerido: number) => {
      if (cursorY - altoRequerido < this.marginBottom) {
        paginaActual = pdfDoc.addPage([this.pageWidth, this.pageHeight]);
        paginas.push(paginaActual);
        cursorY = this.pageHeight - 45;
      }
    };

      const dibujarTextoCentrado = (
      texto: string,
      font: PDFFont,
      size: number,
      espacioInferior: number,
      subrayado = false,
      color: any = rgb(0.05, 0.05, 0.05), // <-- NUEVO PARÁMETRO DE COLOR
    ) => {
      const textoLimpio = this.templatesService
        .sanitizarTextoWinAnsi(texto)
        .replace(/\s+/g, ' ')
        .trim();
      verificarEspacioOSaltarPagina(size + espacioInferior);
      const textWidth = font.widthOfTextAtSize(textoLimpio, size);
      const x = this.marginLeft + (this.contentWidth - textWidth) / 2;

      paginaActual.drawText(textoLimpio, {
        x,
        y: cursorY,
        size,
        font,
        color, // <-- Usamos el color aquí
      });
      if (subrayado) {
        paginaActual.drawLine({
          start: { x, y: cursorY - 1.8 },
          end: { x: x + textWidth, y: cursorY - 1.8 },
          thickness: 0.75,
          color: color, // <-- El subrayado también toma el color
        });
      }
      cursorY -= size + espacioInferior;
    };

    const dibujarTextoIzquierda = (
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
      paginaActual.drawText(textoLimpio, {
        x: this.marginLeft,
        y: cursorY,
        size,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });
      cursorY -= size + espacioInferior;
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
      const textWidth = font.widthOfTextAtSize(textoLimpio, size);
      const x = this.pageWidth - this.marginRight - textWidth;
      paginaActual.drawText(textoLimpio, {
        x,
        y: cursorY,
        size,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });
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
      const offsetIzquierdo = opciones?.offsetIzquierdo ?? 0;
      const etiquetaIzquierda = opciones?.etiquetaColumnaIzquierda;

      const anchoDisponibleBloque = this.contentWidth - offsetIzquierdo;
      const bloquesEnvueltos = this.envolverSegmentosEnLineas(
        segmentos,
        size,
        fontRegular,
        fontBold,
        fontItalic,
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
            const etiquetaLimpia =
              this.templatesService.sanitizarTextoWinAnsi(etiquetaIzquierda);
            paginaActual.drawText(etiquetaLimpia, {
              x: this.marginLeft,
              y: cursorY,
              size,
              font: fontBold,
              color: rgb(0.05, 0.05, 0.05),
            });

            // SUBRAYADO PARA PRIMERO, SEGUNDO, TERCERO...
            const labelWidth = fontBold.widthOfTextAtSize(etiquetaLimpia, size);
            paginaActual.drawLine({
              start: { x: this.marginLeft, y: cursorY - 1.5 },
              end: { x: this.marginLeft + labelWidth, y: cursorY - 1.5 },
              thickness: 0.75,
              color: rgb(0.05, 0.05, 0.05),
            });

            etiquetaDibujada = true;
          }

          const esPrimeraLineaDelBloque = idxLinea === 0;
          const esUltimaLineaDelBloque =
            idxLinea === lineasEnvueltas.length - 1;
          const sangriaLineaActual = esPrimeraLineaDelBloque
            ? sangriaPrimeraLinea
            : 0;
          const anchoLineaMax = anchoDisponibleBloque - sangriaLineaActual;

          const totalAnchoPalabras = linea.reduce((acc, t) => acc + t.ancho, 0);
          let espacioEntrePalabras = anchoEspacioBase;

          if (justificar && !esUltimaLineaDelBloque && linea.length > 1) {
            const espacioDisponible = anchoLineaMax - totalAnchoPalabras;
            const espacioCalculado = espacioDisponible / (linea.length - 1);
            if (espacioCalculado < anchoEspacioBase * 3.5) {
              espacioEntrePalabras = espacioCalculado;
            }
          }

          let x = this.marginLeft + offsetIzquierdo + sangriaLineaActual;
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

        // 1. DIBUJAR ENCABEZADO Y SIEMPRE IMPRIMIR FACULTAD DEBAJO
    if (headerImage) {
      paginaActual.drawImage(headerImage, {
        x: 0,
        y: cursorY - headerImageHeight,
        width: this.pageWidth,
        height: headerImageHeight,
      });
      cursorY -= headerImageHeight + 12;
    } else {
      dibujarTextoCentrado(universidad, fontBold, escala.headerUniSize, 4);
    }

    // AQUÍ ESTÁ EL CAMBIO: Le sumamos +2 al tamaño, color celeste y sin subrayado (false)
    dibujarTextoCentrado(
      facultad,
      fontBold,
      escala.headerFacSize + 3.5,
      8,
      false,
      rgb(0.1, 0.45, 0.75),
    );

    // 2. TÍTULO DE LA RESOLUCIÓN (CON SUBRAYADO Y MÁS GRANDE) Y FECHA
    const serieTexto = resolucion.serie === SerieNumeracion.CF ? ' - CF' : '';
    const tituloResolucionTexto = `RESOLUCIÓN Nº ${resolucion.numeroCorrelativo} - ${resolucion.anioNumeracion}${serieTexto} - FCSa - UAC`;
    
    dibujarTextoCentrado(
      tituloResolucionTexto,
      fontBold,
      escala.titleResSize + 4,
      10,
      true, // Subrayado en true
    );

    // Fecha en Negrita y más grande
    dibujarTextoDerecha(
      `${ciudad}, ${this.templatesService.formatearFechaLargaCastellano(resolucion.fechaEmision)}`,
      fontBold,
      escala.bodySize + 1.5, // <-- AUMENTADO
      10,
    );

    // Línea de autoridad (EL DECANO...) más grande
    dibujarTextoIzquierda(
      'EL DECANO DE LA FACULTAD DE CIENCIAS DE LA SALUD DE LA UNIVERSIDAD ANDINA DEL CUSCO:',
      fontBold,
      escala.bodySize + 1.5, // <-- AUMENTADO
      10,
    );

    // FUNCIÓN AUXILIAR PARA DIBUJAR TÍTULOS DE SECCIÓN
    const dibujarTituloSeccion = (texto: string) => {
      const textoLimpio = this.templatesService.sanitizarTextoWinAnsi(texto);
      const fontSize = escala.bodySize + 1.5; // <-- AUMENTADO AQUÍ
      
      verificarEspacioOSaltarPagina(fontSize + 4);
      const x = this.marginLeft + escala.firstLineIndent; 
      const textWidth = fontBold.widthOfTextAtSize(textoLimpio, fontSize);

      paginaActual.drawText(textoLimpio, {
        x,
        y: cursorY,
        size: fontSize,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });

      paginaActual.drawLine({
        start: { x, y: cursorY - 1.5 },
        end: { x: x + textWidth, y: cursorY - 1.5 },
        thickness: 0.75,
        color: rgb(0.05, 0.05, 0.05),
      });

      cursorY -= fontSize + 4;
    };

    // 4. SECCIÓN VISTO
    dibujarTituloSeccion('VISTO:');
    dibujarParrafoCompuesto(this.parsearTextoConFormato(secciones.visto), {
      sangriaPrimeraLinea: escala.firstLineIndent,
    });

    cursorY -= 8; // <-- ESPACIO EXTRA ANTES DE CONSIDERANDO

    // 5. SECCIÓN CONSIDERANDO
    dibujarTituloSeccion('CONSIDERANDO:');
    for (const parrafo of secciones.considerando) {
      dibujarParrafoCompuesto(this.parsearTextoConFormato(parrafo), {
        sangriaPrimeraLinea: escala.firstLineIndent,
      });
    }

    cursorY -= 8; // <-- ESPACIO EXTRA ANTES DE RESUELVE

    // 6. SECCIÓN RESUELVE
    dibujarTituloSeccion('RESUELVE:');
    for (const art of secciones.articulosResolutivos) {
      dibujarParrafoCompuesto(this.parsearTextoConFormato(art.texto), {
        offsetIzquierdo: escala.articleLabelWidth,
        etiquetaColumnaIzquierda: art.titulo,
      });
    }

    // 7. CIERRE Y BLOQUE DE DISTRIBUCIÓN (ESTILO IMAGEN)
    verificarEspacioOSaltarPagina(escala.signatureBlockHeight);
    cursorY -= 15; // Espacio de separación antes del cierre

    // A) "Regístrese, Comuníquese y Archívese." con línea punteada
    const textoRegistrese = 'Regístrese, Comuníquese y Archívese. ';
    paginaActual.drawText(this.templatesService.sanitizarTextoWinAnsi(textoRegistrese), {
      x: this.marginLeft,
      y: cursorY,
      size: escala.bodySize + 1,
      font: fontBoldItalic,
      color: rgb(0.05, 0.05, 0.05),
    });

    const anchoTexto = fontBoldItalic.widthOfTextAtSize(textoRegistrese, escala.bodySize + 1);
    // Línea de guiones al lado
    paginaActual.drawText('. '.repeat(40), {
      x: this.marginLeft + anchoTexto,
      y: cursorY,
      size: escala.bodySize + 1,
      font: fontBoldItalic,
      color: rgb(0.05, 0.05, 0.05),
    });

    // B) Bloque de distribución justo debajo
    cursorY -= 14; 
    const inicialesDecano = (inicialesDecanoVigente || 'JAAFD').toUpperCase();
    const inicialesOperador = (resolucion.inicialesOperador || 'avc').toLowerCase();

    const lineasDistribucion = [
      `FCSa/${inicialesDecano}/${inicialesOperador}`,
      'Interesado (a)',
      'Jurados',
      'Asesor (a)',
      'Expediente (1)',
      'Archivo (1).',
    ];

    for (const lineaDist of lineasDistribucion) {
      paginaActual.drawText(
        this.templatesService.sanitizarTextoWinAnsi(lineaDist),
        {
          x: this.marginLeft,
          y: cursorY,
          size: 8.5, // Un poco más grande
          font: fontBold, // En negrita
          color: rgb(0.05, 0.05, 0.05),
        },
      );
      cursorY -= 10; // Interlineado
    }

    // 9. PIE DE PÁGINA INSTITUCIONAL Y SELLO 100% INVISIBLE EN (0,0)
    const selloInvisibleLimpio =
      this.templatesService.sanitizarTextoWinAnsi(selloControl);

    for (const pag of paginas) {
      try {
        const footerImage = await this.cargarImagen(
          pdfDoc,
          this.footerImagePath,
        );
        if (footerImage) {
          const imgDims = footerImage.scale(1);
          const imgWidth = this.pageWidth;
          const footerImageHeight = (imgDims.height / imgDims.width) * imgWidth;
          pag.drawImage(footerImage, {
            x: 0,
            y: 0,
            width: imgWidth,
            height: footerImageHeight,
          });
        }
      } catch (error: any) {
        console.error(
          '❌ Error al cargar la imagen del pie de página:',
          error.message,
        );
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