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

  private readonly pageWidth = 595.28;
  private readonly pageHeight = 841.89;
  private readonly marginLeft = 65;
  private readonly marginRight = 65;
  private readonly marginTop = 0; // <-- Ajustado para eliminar el espacio en blanco superior
  private readonly marginBottom = 75;
  private readonly contentWidth =
    this.pageWidth - this.marginLeft - this.marginRight;

  constructor(
    private readonly templatesService: ResolucionTemplatesService,
  ) {}

  private async cargarImagen(pdfDoc: PDFDocument, ruta: string): Promise<any> {
    if (!fs.existsSync(ruta)) return null;
    const bytes = fs.readFileSync(ruta);
    if (bytes.length < 4) return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return await pdfDoc.embedPng(bytes);
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return await pdfDoc.embedJpg(bytes);
    }
    return null;
  }

  private construirEscala(bodySize: number): EscalaTipografica {
    const ratio = bodySize / 11;
    return {
      bodySize,
      lineHeight: Number((bodySize * 1.38).toFixed(2)),
      paragraphSpacing: Math.max(5, Math.round(10 * ratio)),
      headerUniSize: Number((14 * ratio).toFixed(2)),
      headerFacSize: Number((11.5 * ratio).toFixed(2)),
      titleResSize: Number((12 * ratio).toFixed(2)),
      signatureBlockHeight: Math.round(75 * ratio),
      closingSpacing: Math.max(18, Math.round(38 * ratio)),
    };
  }

  private envolverSegmentosEnLineas(
    segmentos: SegmentoTexto[],
    size: number,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    fontItalic: PDFFont,
  ): PalabraToken[][][] {
    const bloquesDeLinea: PalabraToken[][] = [[]];

    for (const seg of segmentos) {
      const font = seg.negrita ? fontBold : seg.cursiva ? fontItalic : fontRegular;
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
        const espacioNecesario = lineaActual.length === 0 ? token.ancho : anchoEspacioBase + token.ancho;

        if (anchoAcumulado + espacioNecesario <= this.contentWidth || lineaActual.length === 0) {
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
    const { resolucion, configuracion, nombreDecanoVigente, inicialesDecanoVigente } = params;

    const codigoExpediente = resolucion.expediente?.codigoExpediente || 'EXP-S/N';
    const universidad = this.templatesService.sanitizarTextoWinAnsi((configuracion?.universidad || 'UNIVERSIDAD ANDINA DEL CUSCO').toUpperCase());
    const facultad = this.templatesService.sanitizarTextoWinAnsi((configuracion?.facultad || 'FACULTAD DE CIENCIAS DE LA SALUD').toUpperCase());
    const ciudad = this.templatesService.sanitizarTextoWinAnsi(configuracion?.ciudad || 'Cusco');

    const datosEspecificos = (resolucion.datosEspecificos as Record<string, any>) || {};
    const secciones = this.templatesService.construirSeccionesJuridicas(resolucion.tipo, datosEspecificos, codigoExpediente);

    const selloControl = `ID-TRAMITE: ${resolucion.idTramiteControl} | VER: ${resolucion.versionPdf} | HASH: ${resolucion.hashVersionGenerado}`;

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const fontFooter = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let headerImage: any = null;
    let headerImageHeight = 0;
    try {
      headerImage = await this.cargarImagen(pdfDoc, this.headerImagePath);
      if (headerImage) {
        const imgDims = headerImage.scale(1);
        const imgWidth = this.pageWidth;
        headerImageHeight = (imgDims.height / imgDims.width) * imgWidth;
      }
    } catch (error) {
      console.error('❌ Error al cargar la imagen del encabezado:', error.message);
    }

    // Forzamos la fuente a 11pt para que se vea igual que en Word.
    // El texto pasará a la página 2 automáticamente si es necesario.
    const escalaSeleccionada = this.construirEscala(11);

    const paginas: PDFPage[] = [];
    let paginaActual = pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    paginas.push(paginaActual);
    let cursorY = this.pageHeight - this.marginTop;

    const verificarEspacioOSaltarPagina = (altoRequerido: number) => {
      if (cursorY - altoRequerido < this.marginBottom) {
        paginaActual = pdfDoc.addPage([this.pageWidth, this.pageHeight]);
        paginas.push(paginaActual);
        cursorY = this.pageHeight - this.marginTop;
      }
    };

    const dibujarTextoCentrado = (texto: string, font: PDFFont, size: number, espacioInferior: number, subrayado = false) => {
      const textoLimpio = this.templatesService.sanitizarTextoWinAnsi(texto);
      verificarEspacioOSaltarPagina(size + espacioInferior);
      const textWidth = font.widthOfTextAtSize(textoLimpio, size);
      const x = this.marginLeft + (this.contentWidth - textWidth) / 2;

      paginaActual.drawText(textoLimpio, { x, y: cursorY, size, font, color: rgb(0.05, 0.05, 0.05) });
      if (subrayado) {
        paginaActual.drawLine({ start: { x, y: cursorY - 2 }, end: { x: x + textWidth, y: cursorY - 2 }, thickness: 0.8, color: rgb(0.05, 0.05, 0.05) });
      }
      cursorY -= size + espacioInferior;
    };

    const dibujarTextoIzquierda = (texto: string, font: PDFFont, size: number, espacioInferior: number) => {
      const textoLimpio = this.templatesService.sanitizarTextoWinAnsi(texto);
      verificarEspacioOSaltarPagina(size + espacioInferior);
      paginaActual.drawText(textoLimpio, { x: this.marginLeft, y: cursorY, size, font, color: rgb(0.05, 0.05, 0.05) });
      cursorY -= size + espacioInferior;
    };

    const dibujarTextoDerecha = (texto: string, font: PDFFont, size: number, espacioInferior: number) => {
      const textoLimpio = this.templatesService.sanitizarTextoWinAnsi(texto);
      verificarEspacioOSaltarPagina(size + espacioInferior);
      const textWidth = font.widthOfTextAtSize(textoLimpio, size);
      const x = this.pageWidth - this.marginRight - textWidth;
      paginaActual.drawText(textoLimpio, { x, y: cursorY, size, font, color: rgb(0.05, 0.05, 0.05) });
      cursorY -= size + espacioInferior;
    };

    const dibujarParrafoCompuesto = (segmentos: SegmentoTexto[], size = escalaSeleccionada.bodySize, lineHeight = escalaSeleccionada.lineHeight, espacioInferior = escalaSeleccionada.paragraphSpacing, justificar = true) => {
      const bloquesEnvueltos = this.envolverSegmentosEnLineas(segmentos, size, fontRegular, fontBold, fontItalic);
      const anchoEspacioBase = fontRegular.widthOfTextAtSize(' ', size);

      for (const lineasEnvueltas of bloquesEnvueltos) {
        if (lineasEnvueltas.length === 0) { cursorY -= lineHeight * 0.5; continue; }

        lineasEnvueltas.forEach((linea, idxLinea) => {
          verificarEspacioOSaltarPagina(lineHeight);
          const esUltimaLineaDelBloque = idxLinea === lineasEnvueltas.length - 1;
          const totalAnchoPalabras = linea.reduce((acc, t) => acc + t.ancho, 0);
          let espacioEntrePalabras = anchoEspacioBase;

          if (justificar && !esUltimaLineaDelBloque && linea.length > 1) {
            const espacioDisponible = this.contentWidth - totalAnchoPalabras;
            const espacioCalculado = espacioDisponible / (linea.length - 1);
            if (espacioCalculado < anchoEspacioBase * 3.5) espacioEntrePalabras = espacioCalculado;
          }

          let x = this.marginLeft;
          for (const token of linea) {
            paginaActual.drawText(token.palabra, { x, y: cursorY, size, font: token.font, color: rgb(0.05, 0.05, 0.05) });
            x += token.ancho + espacioEntrePalabras;
          }
          cursorY -= lineHeight;
        });
      }
      cursorY -= espacioInferior;
    };

    // DIBUJAR ENCABEZADO
    if (headerImage) {
      paginaActual.drawImage(headerImage, {
        x: 0,
        y: cursorY - headerImageHeight,
        width: this.pageWidth,
        height: headerImageHeight,
      });
      cursorY -= headerImageHeight + 5;
    } else {
      dibujarTextoCentrado(universidad, fontBold, escalaSeleccionada.headerUniSize, 4);
      dibujarTextoCentrado(facultad, fontBold, escalaSeleccionada.headerFacSize, 10);
    }

    // Título y fecha
    const ratio = escalaSeleccionada.bodySize / 11;
    // Título adaptado al formato oficial: RESOLUCIÓN Nº 4184 - 2026 - FCSa - UAC
    dibujarTextoCentrado(
      `RESOLUCIÓN Nº ${resolucion.numeroCorrelativo} - ${resolucion.anioNumeracion} - FCSa - UAC`,
      fontBold,
      escalaSeleccionada.titleResSize,
      Math.round(15 * ratio),
      true,
    );
    dibujarTextoDerecha(`${ciudad}, ${this.templatesService.formatearFechaLargaCastellano(resolucion.fechaEmision)}`, fontRegular, escalaSeleccionada.bodySize, Math.round(15 * ratio));

    // Línea oficial EL DECANO...
    dibujarTextoCentrado('EL DECANO DE LA FACULTAD DE CIENCIAS DE LA SALUD DE LA UNIVERSIDAD ANDINA DEL CUSCO:', fontBold, escalaSeleccionada.bodySize, Math.round(15 * ratio));

    // VISTO
    dibujarTextoIzquierda('VISTO:', fontBold, escalaSeleccionada.bodySize, 4);
    dibujarParrafoCompuesto([{ texto: secciones.visto }]);

    // CONSIDERANDO
    dibujarTextoIzquierda('CONSIDERANDO:', fontBold, escalaSeleccionada.bodySize, 4);
    for (const parrafo of secciones.considerando) {
      dibujarParrafoCompuesto([{ texto: parrafo }]);
    }

    // SE RESUELVE (cambiado a RESUELVE:)
    dibujarTextoIzquierda('RESUELVE:', fontBold, escalaSeleccionada.bodySize, 4);
    for (const art of secciones.articulosResolutivos) {
      dibujarParrafoCompuesto([{ texto: `${art.titulo} `, negrita: true }, { texto: art.texto }]);
    }

    cursorY -= 6;
    dibujarParrafoCompuesto([{ texto: 'Regístrese, comuníquese y archívese.', cursiva: true }], escalaSeleccionada.bodySize, escalaSeleccionada.lineHeight, escalaSeleccionada.closingSpacing, false);

    // FIRMA
    verificarEspacioOSaltarPagina(escalaSeleccionada.signatureBlockHeight);
    cursorY -= Math.round(15 * ratio);

    const nombreFirmanteFinal = (resolucion.nombreDecanoSnapshot || nombreDecanoVigente || 'DECANO DE LA FACULTAD DE CIENCIAS DE LA SALUD').toUpperCase();
    const inicialesDecano = inicialesDecanoVigente || 'JAAFD';

    dibujarTextoCentrado('Firmado digitalmente por:', fontItalic, Number((10 * ratio).toFixed(2)), 4);
    dibujarTextoCentrado(nombreFirmanteFinal, fontBold, escalaSeleccionada.bodySize, 2);
    dibujarTextoCentrado(`DECANO(A) DE LA ${facultad}`, fontRegular, Number((9.5 * ratio).toFixed(2)), 12);
    dibujarTextoCentrado(`Iniciales: ${resolucion.inicialesOperador} / ${inicialesDecano}`, fontFooter, 8.5, 10);

    // PIE DE PÁGINA Y SELLO
    const totalPaginas = paginas.length;
    const selloInvisibleLimpio = this.templatesService.sanitizarTextoWinAnsi(selloControl);

    for (const [idx, pag] of paginas.entries()) {
      let footerImage: any = null;
      let footerImageHeight = 0;
      try {
        footerImage = await this.cargarImagen(pdfDoc, this.footerImagePath);
        if (footerImage) {
          const imgDims = footerImage.scale(1);
          const imgWidth = this.pageWidth;
          footerImageHeight = (imgDims.height / imgDims.width) * imgWidth;
          pag.drawImage(footerImage, { x: 0, y: 0, width: imgWidth, height: footerImageHeight });
        }
      } catch (error) {
        console.error('❌ Error al cargar la imagen del pie de página:', error.message);
      }

      pag.drawText(selloInvisibleLimpio, { x: 0, y: 0, size: 0.1, font: fontFooter, color: rgb(1, 1, 1) });

      const yFooter = footerImageHeight > 0 ? footerImageHeight + 5 : 35;

      if (footerImageHeight === 0) {
        pag.drawLine({ start: { x: this.marginLeft, y: yFooter + 10 }, end: { x: this.pageWidth - this.marginRight, y: yFooter + 10 }, thickness: 0.4, color: rgb(0.7, 0.75, 0.8) });
      }

      const textoIzquierda = this.templatesService.sanitizarTextoWinAnsi(`/${resolucion.inicialesOperador} | ${selloControl}`);
      pag.drawText(textoIzquierda, { x: this.marginLeft, y: yFooter, size: 7.5, font: fontFooter, color: rgb(0.3, 0.35, 0.4) });

      const textoDerecha = `Pag. ${idx + 1} de ${totalPaginas}`;
      const anchoDer = fontFooter.widthOfTextAtSize(textoDerecha, 7.5);
      pag.drawText(textoDerecha, { x: this.pageWidth - this.marginRight - anchoDer, y: yFooter, size: 7.5, font: fontFooter, color: rgb(0.3, 0.35, 0.4) });
    }

    // METADATOS
    pdfDoc.setTitle(`RESOLUCIÓN Nº ${resolucion.numeroCorrelativo} - ${resolucion.anioNumeracion} - FCSa - UAC`);
    pdfDoc.setAuthor(`${universidad} - ${facultad}`);
    pdfDoc.setSubject(selloControl);
    pdfDoc.setKeywords(['FCSa-UAC', resolucion.idTramiteControl, `VER-${resolucion.versionPdf}`, `HASH-${resolucion.hashVersionGenerado}`, resolucion.numeroCompleto]);
    pdfDoc.setProducer('Sistema de Resoluciones de Titulacion FCSa-UAC (NestJS + pdf-lib)');
    pdfDoc.setCreationDate(new Date());

    const pdfBytes = await pdfDoc.save();
    const bufferFinal = Buffer.from(pdfBytes);
    const nombreArchivo = `${resolucion.numeroCompleto}_v${resolucion.versionPdf}.pdf`;

    return { buffer: bufferFinal, nombreArchivo, selloControl };
  }

  async extraerMetadatosBuffer(buffer: Buffer, nombreArchivo: string, selloControl: string) {
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