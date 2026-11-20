import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  EstadoDocumentalRes,
  EstadoExpediente,
  EstadoTesista,
  EstadoUsuario,
  PrismaService,
  SerieNumeracion,
  SituacionJuridicaRes,
  TipoResolucion,
} from '@app/database';
import { PDFDocument, PDFRawStream, StandardFonts, rgb } from 'pdf-lib';
import * as forge from 'node-forge';
import AdmZip = require('adm-zip');
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface ResultadoArchivoLote {
  nombreArchivo: string;
  sha256Archivo: string;
  exito: boolean;
  resolucionId?: string;
  numeroCompleto?: string;
  idTramiteDetectado?: string;
  metodoIdentificacion?:
    | 'NIVEL_1_METADATOS'
    | 'NIVEL_2_PIE_PAGINA_STREAM'
    | 'NIVEL_3_NUMERO_RESOLUCION';
  firmanteCertificado?: string;
  expedienteCerradoComoTitulado?: boolean;
  codigoError?: string;
  mensajeError?: string;
}

export interface EjecutorFirma {
  id: string;
  iniciales?: string;
}

@Injectable()
export class FirmasServiceService implements OnModuleInit {
  private readonly logger = new Logger(FirmasServiceService.name);
  private readonly storageRoot = path.resolve(process.cwd(), 'storage', 'firmados');

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!fs.existsSync(this.storageRoot)) {
      fs.mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  private async resolverUsuarioAuditoriaId(
    client: Pick<PrismaService, 'usuario'>,
    ejecutor: EjecutorFirma,
  ): Promise<string | null> {
    if (!client?.usuario) return null;

    try {
      if (ejecutor?.id) {
        const porId = await client.usuario.findUnique({
          where: { id: ejecutor.id },
          select: { id: true },
        });
        if (porId) return porId.id;
      }

      if (ejecutor?.iniciales) {
        const porIniciales = await client.usuario.findFirst({
          where: {
            iniciales: { equals: ejecutor.iniciales, mode: 'insensitive' },
            estado: EstadoUsuario.ACTIVO,
          },
          select: { id: true },
        });
        if (porIniciales) return porIniciales.id;
      }

      const fallback = await client.usuario.findFirst({
        where: { estado: EstadoUsuario.ACTIVO },
        select: { id: true },
      });
      return fallback?.id ?? null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // 1. OBTENCIÓN DE PDF SIN FIRMAR (VÍA DOCUMENTOS-SERVICE O RESPALDO LOCAL)
  // ==========================================================================
  async obtenerPdfEmitidoSinFirmar(
    resolucionId: string,
    authHeader?: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string; numeroCompleto: string }> {
    const resolucion = await this.prisma.resolucion.findUnique({
      where: { id: resolucionId },
      include: {
        expediente: { select: { codigoExpediente: true } },
      },
    });

    if (!resolucion) {
      throw new NotFoundException(`La resolución ${resolucionId} no existe.`);
    }

    const docsUrl = process.env.DOCUMENTOS_SERVICE_URL || 'http://localhost:4002';

    try {
      const response = await fetch(`${docsUrl}/api/documentos/${resolucion.id}/pdf`, {
        method: 'GET',
        headers: authHeader ? { Authorization: authHeader } : {},
      });

      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuf),
          nombreArchivo: `${resolucion.numeroCompleto}_v${resolucion.versionPdf}.pdf`,
          numeroCompleto: resolucion.numeroCompleto,
        };
      }
    } catch {
      // Si documentos-service (4002) no está disponible, se activa el generador autónomo de respaldo
    }

    const bufferRespaldo = await this.generarPdfRespaldoAutonomo(resolucion);
    return {
      buffer: bufferRespaldo,
      nombreArchivo: `${resolucion.numeroCompleto}_v${resolucion.versionPdf}.pdf`,
      numeroCompleto: resolucion.numeroCompleto,
    };
  }

  private async generarPdfRespaldoAutonomo(resolucion: any): Promise<Buffer> {
    const selloControl = `ID-TRAMITE: ${resolucion.idTramiteControl} | VER: ${resolucion.versionPdf} | HASH: ${resolucion.hashVersionGenerado}`;
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontFooter = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawText('UNIVERSIDAD ANDINA DEL CUSCO - FACULTAD DE CIENCIAS DE LA SALUD', {
      x: 65,
      y: 770,
      size: 12,
      font: fontBold,
    });
    page.drawText(`RESOLUCION N.° ${resolucion.numeroCompleto} (${resolucion.tipo})`, {
      x: 65,
      y: 740,
      size: 11,
      font: fontBold,
    });
    page.drawText(`Firmante: ${resolucion.nombreDecanoSnapshot}`, {
      x: 65,
      y: 700,
      size: 10,
      font: fontRegular,
    });
    page.drawText(`/${resolucion.inicialesOperador}   |   ${selloControl}`, {
      x: 65,
      y: 35,
      size: 7.5,
      font: fontFooter,
      color: rgb(0.3, 0.35, 0.4),
    });

    pdfDoc.setSubject(selloControl);
    pdfDoc.setKeywords([
      'FCSa-UAC',
      resolucion.idTramiteControl,
      `VER-${resolucion.versionPdf}`,
      `HASH-${resolucion.hashVersionGenerado}`,
      resolucion.numeroCompleto,
    ]);

    return Buffer.from(await pdfDoc.save());
  }

  // ==========================================================================
  // 2. DESCARGA MASIVA EN ZIP CON MANIFIESTO (GET /api/firmas/pendientes/zip)
  // ==========================================================================
  async listarResolucionesPendientesFirma(filtros?: {
    serie?: SerieNumeracion;
    expedienteId?: string;
  }) {
    return this.prisma.resolucion.findMany({
      where: {
        estadoDocumental: EstadoDocumentalRes.EMITIDO,
        situacionJuridica: SituacionJuridicaRes.VIGENTE,
        ...(filtros?.serie ? { serie: filtros.serie } : {}),
        ...(filtros?.expedienteId ? { expedienteId: filtros.expedienteId } : {}),
      },
      include: {
        expediente: {
          select: {
            id: true,
            codigoExpediente: true,
            escuelaProfesional: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ anioNumeracion: 'desc' }, { numeroCorrelativo: 'asc' }],
    });
  }

  async generarZipPendientesFirma(
    filtros: { serie?: SerieNumeracion; expedienteId?: string },
    authHeader?: string,
  ): Promise<{ zipBuffer: Buffer; nombreZip: string; cantidadArchivos: number }> {
    const pendientes = await this.listarResolucionesPendientesFirma(filtros);

    if (pendientes.length === 0) {
      throw new BadRequestException(
        'No existen resoluciones en estado EMITIDO y VIGENTE pendientes de firma con los filtros indicados.',
      );
    }

    const zip = new AdmZip();
    const manifiestoItems: Array<Record<string, unknown>> = [];

    for (const res of pendientes) {
      const { buffer, nombreArchivo } = await this.obtenerPdfEmitidoSinFirmar(res.id, authHeader);
      zip.addFile(nombreArchivo, buffer);

      manifiestoItems.push({
        resolucionId: res.id,
        numeroCompleto: res.numeroCompleto,
        serie: res.serie,
        tipo: res.tipo,
        codigoExpediente: res.expediente?.codigoExpediente ?? 'SIN-EXPEDIENTE',
        escuelaProfesional: res.expediente?.escuelaProfesional?.nombre ?? 'SIN-ESCUELA',
        idTramiteControl: res.idTramiteControl,
        versionPdf: res.versionPdf,
        hashVersionEsperado: res.hashVersionGenerado,
        nombreDecanoSnapshot: res.nombreDecanoSnapshot,
        archivoEnZip: nombreArchivo,
        sha256PdfEmitido: crypto.createHash('sha256').update(buffer).digest('hex'),
      });
    }

    const manifiestoLote = {
      facultad: 'Facultad de Ciencias de la Salud - Universidad Andina del Cusco',
      fechaGeneracionLote: new Date().toISOString(),
      totalResolucionesPendientes: manifiestoItems.length,
      instrucciones:
        'Firme los archivos PDF utilizando Tocapu o su software de firma digital PKCS#7/PAdES y súbalos individualmente o en lote al endpoint POST /api/firmas/validar-lote.',
      resoluciones: manifiestoItems,
    };

    zip.addFile(
      'manifiesto_lote.json',
      Buffer.from(JSON.stringify(manifiestoLote, null, 2), 'utf-8'),
    );

    const fechaStr = new Date().toISOString().slice(0, 10);
    const nombreZip = `LOTE_PENDIENTES_FIRMA_FCSA_${fechaStr}.zip`;

    return {
      zipBuffer: zip.toBuffer(),
      nombreZip,
      cantidadArchivos: manifiestoItems.length,
    };
  }

  // ==========================================================================
  // 3. EXTRACCIÓN EN CASCADA DE 3 NIVELES (RESISTENTE A TOCAPU)
  // ==========================================================================
  private async extraerIdentificadorEnCascada(
    pdfBuffer: Buffer,
    nombreArchivoSubido: string,
  ): Promise<{
    idTramite: string | null;
    versionDetectada: number | null;
    hashDetectado: string | null;
    numeroResolucionDetectado: string | null;
    metodo:
      | 'NIVEL_1_METADATOS'
      | 'NIVEL_2_PIE_PAGINA_STREAM'
      | 'NIVEL_3_NUMERO_RESOLUCION';
  }> {
    const regexSelloCompleto =
      /ID-TRAMITE:\s*((?:TRAM-\d{4}-\d{4,}-[A-F0-9]{6,}|TRM-\d{4}-(?:ORD|CF)-\d{4,}|TRAM-[A-Z0-9-]+))\s*\|\s*VER:\s*(\d+)\s*\|\s*HASH:\s*([A-F0-9]{6,64})/i;

    let pdfDoc: PDFDocument | null = null;
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    } catch {
      throw new BadRequestException(
        'CORRUPTO_O_NO_PDF: El archivo no es un documento PDF válido.',
      );
    }

    // ------------------------------------------------------------------------
    // NIVEL 1: METADATOS INTERNOS DEL DICCIONARIO /Info (Subject y Keywords)
    // ------------------------------------------------------------------------
    const subject = pdfDoc.getSubject() || '';
    const matchSubject = subject.match(regexSelloCompleto);
    if (matchSubject) {
      return {
        idTramite: matchSubject[1].toUpperCase(),
        versionDetectada: Number(matchSubject[2]),
        hashDetectado: matchSubject[3].toUpperCase(),
        numeroResolucionDetectado: null,
        metodo: 'NIVEL_1_METADATOS',
      };
    }

    const keywordsStr = pdfDoc.getKeywords() || '';
    const matchKwTramite = keywordsStr.match(
      /((?:TRAM-\d{4}-\d{4,}-[A-F0-9]{6,}|TRM-\d{4}-(?:ORD|CF)-\d{4,}|TRAM-[A-Z0-9-]+))/i,
    );
    const matchKwVer = keywordsStr.match(/VER-(\d+)/i);
    const matchKwHash = keywordsStr.match(/HASH-([A-F0-9]{6,64})/i);
    if (matchKwTramite && matchKwVer && matchKwHash) {
      return {
        idTramite: matchKwTramite[1].toUpperCase(),
        versionDetectada: Number(matchKwVer[1]),
        hashDetectado: matchKwHash[1].toUpperCase(),
        numeroResolucionDetectado: null,
        metodo: 'NIVEL_1_METADATOS',
      };
    }

    // ------------------------------------------------------------------------
    // NIVEL 2: DESCOMPRESIÓN DE STREAMS INTERNOS DEL PDF (PIE DE PÁGINA)
    // Si Tocapu borró el diccionario /Info, descomprimimos los content streams
    // ------------------------------------------------------------------------
    const textosStreams: string[] = [pdfBuffer.toString('latin1')];

    for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream) {
        const rawBytes = Buffer.from(obj.contents);
        textosStreams.push(rawBytes.toString('latin1'));
        try {
          const inflado = zlib.inflateSync(rawBytes);
          textosStreams.push(inflado.toString('latin1'));
        } catch {
          // Algunos streams no están comprimidos con FlateDecode; se ignora silenciosamente
        }
      }
    }

    const corpusTextoCompleto = textosStreams.join('\n');
    const matchStream = corpusTextoCompleto.match(regexSelloCompleto);
    if (matchStream) {
      return {
        idTramite: matchStream[1].toUpperCase(),
        versionDetectada: Number(matchStream[2]),
        hashDetectado: matchStream[3].toUpperCase(),
        numeroResolucionDetectado: null,
        metodo: 'NIVEL_2_PIE_PAGINA_STREAM',
      };
    }

    // ------------------------------------------------------------------------
    // NIVEL 3: RESPALDO POR NÚMERO OFICIAL DE RESOLUCIÓN EN TEXTO O NOMBRE DE ARCHIVO
    // ------------------------------------------------------------------------
    const regexNumeroResolucion =
      /(RES-(?:ORD|CF)-\d{4}-\d{4,}|\d{4}-\d{4}(?:-CF)?-FCSa-UAC)/i;
    const matchNumEnTexto = corpusTextoCompleto.match(regexNumeroResolucion);
    const matchNumEnArchivo = nombreArchivoSubido.match(regexNumeroResolucion);
    const matchVerEnArchivo = nombreArchivoSubido.match(/_v(\d+)/i);

    const numeroDetectado = matchNumEnTexto
      ? matchNumEnTexto[1]
      : matchNumEnArchivo
        ? matchNumEnArchivo[1]
        : null;

    return {
      idTramite: null,
      versionDetectada: matchVerEnArchivo ? Number(matchVerEnArchivo[1]) : null,
      hashDetectado: null,
      numeroResolucionDetectado: numeroDetectado,
      metodo: 'NIVEL_3_NUMERO_RESOLUCION',
    };
  }

  // ==========================================================================
  // 4. VALIDACIÓN CRIPTOGRÁFICA PKCS#7 / CAdES / PAdES (SOPORTA TOCAPU)
  // ==========================================================================
  private validarFirmaCriptograficaPkcs7(
    pdfBuffer: Buffer,
    nombreDecanoEsperado: string,
  ): {
    firmanteCN: string;
    organizacion: string;
    algoritmoDigest: string;
  } {
    const rawLatin1 = pdfBuffer.toString('latin1');

    // 1. Verificar que exista diccionario de firma digital (/Type /Sig o /SubFilter PKCS#7/CAdES)
    const tieneDiccionarioSig =
      /\/Type\s*\/Sig\b/.test(rawLatin1) ||
      /\/SubFilter\s*\/(?:adbe\.pkcs7\.detached|adbe\.pkcs7\.sha1|ETSI\.CAdES\.detached)/i.test(
        rawLatin1,
      );

    const matchesByteRange = Array.from(
      rawLatin1.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g),
    );

    if (!tieneDiccionarioSig || matchesByteRange.length === 0) {
      throw new BadRequestException(
        'SIN_FIRMA_DIGITAL: El documento PDF subido no contiene estructura de firma digital (/Type /Sig ni /ByteRange).',
      );
    }

    // Tomar la última firma aplicada al documento
    const ultimoMatchBr = matchesByteRange[matchesByteRange.length - 1];
    const b0 = Number(ultimoMatchBr[1]);
    const l0 = Number(ultimoMatchBr[2]);
    const b1 = Number(ultimoMatchBr[3]);
    const l1 = Number(ultimoMatchBr[4]);

    // 2. Verificar que el ByteRange sea coherente y cubra hasta el final del archivo (sin bytes inyectados tras la firma)
    if (b0 !== 0 || l0 <= 0 || b1 <= l0 || l1 <= 0 || b1 + l1 > pdfBuffer.length) {
      throw new BadRequestException(
        'BYTE_RANGE_INVALIDO: Los punteros /ByteRange de la firma están corruptos.',
      );
    }

    const bytesNoCubiertosAlFinal = pdfBuffer.length - (b1 + l1);
    if (bytesNoCubiertosAlFinal > 2) {
      throw new BadRequestException(
        'DOCUMENTO_ALTERADO: Se detectaron bytes añadidos al final del archivo después de haberse estampado la firma digital.',
      );
    }

    // Extraer el bloque hexadecimal entre l0 ('<') y b1 ('>')
    const bloqueContentsRaw = pdfBuffer.subarray(l0, b1).toString('latin1').trim();
    const matchHex = bloqueContentsRaw.match(/^<([0-9A-Fa-f\s]+)>$/);

    let hexLimpio = '';
    if (matchHex) {
      hexLimpio = matchHex[1].replace(/\s+/g, '');
    } else {
      const matchesContents = Array.from(
        rawLatin1.matchAll(/\/Contents\s*<([0-9A-Fa-f\s]{128,})>/g),
      );
      if (matchesContents.length === 0) {
        throw new BadRequestException(
          'SIN_CONTENEDOR_PKCS7: No se encontró el contenedor criptográfico /Contents en el PDF.',
        );
      }
      hexLimpio = matchesContents[matchesContents.length - 1][1].replace(/\s+/g, '');
    }

    // Quitar el relleno de ceros (padding) final del contenedor DER
    const derBufferCompleto = Buffer.from(hexLimpio, 'hex');
    let finDer = derBufferCompleto.length;
    while (finDer > 0 && derBufferCompleto[finDer - 1] === 0) {
      finDer--;
    }
    const derBufferLimpio = derBufferCompleto.subarray(0, finDer);

    let asn1Obj: forge.asn1.Asn1;
    let p7Msg: any;
    try {
      asn1Obj = forge.asn1.fromDer(
        forge.util.createBuffer(derBufferLimpio.toString('binary')),
        false,
      );
      p7Msg = forge.pkcs7.messageFromAsn1(asn1Obj);
    } catch {
      throw new BadRequestException(
        'PKCS7_CORRUPTO: La estructura criptográfica ASN.1 PKCS#7/CAdES no es válida o fue alterada.',
      );
    }

    const certificados: forge.pki.Certificate[] = p7Msg.certificates || [];
    if (certificados.length === 0) {
      throw new BadRequestException(
        'SIN_CERTIFICADO_X509: La firma digital no incluye ningún certificado X.509 de respaldo.',
      );
    }

    const certFirmante = certificados[0];
    const cnField = certFirmante.subject.getField('CN');
    const orgField = certFirmante.subject.getField('O');
    const firmanteCN = cnField ? String(cnField.value) : 'FIRMANTE DESCONOCIDO';
    const organizacion = orgField ? String(orgField.value) : 'SIN ORGANIZACIÓN';

    // 3. Verificar integridad matemática del ByteRange frente al messageDigest autenticado del PKCS#7
    const bytesFirmadosDelPdf = Buffer.concat([
      pdfBuffer.subarray(b0, b0 + l0),
      pdfBuffer.subarray(b1, b1 + l1),
    ]);

    const hashesCalculados = {
      sha256: crypto.createHash('sha256').update(bytesFirmadosDelPdf).digest('hex').toLowerCase(),
      sha1: crypto.createHash('sha1').update(bytesFirmadosDelPdf).digest('hex').toLowerCase(),
      sha384: crypto.createHash('sha384').update(bytesFirmadosDelPdf).digest('hex').toLowerCase(),
      sha512: crypto.createHash('sha512').update(bytesFirmadosDelPdf).digest('hex').toLowerCase(),
    };

    const rawCapture = p7Msg.rawCapture || {};
    const authenticatedAttributes: forge.asn1.Asn1[] = rawCapture.authenticatedAttributes || [];

    let messageDigestExtraidoHex: string | null = null;
    for (const attr of authenticatedAttributes) {
      if (attr.value && Array.isArray(attr.value) && attr.value.length >= 2) {
        const oidAsn1 = attr.value[0];
        const oidStr = forge.asn1.derToOid(oidAsn1.value as string);
        // OID 1.2.840.113549.1.9.4 = PKCS#9 messageDigest
        if (oidStr === forge.pki.oids.messageDigest) {
          const setVal = attr.value[1];
          if (Array.isArray(setVal.value) && setVal.value[0]) {
            const digestBinary = String(setVal.value[0].value as string);
            messageDigestExtraidoHex = Buffer.from(digestBinary, 'binary')
              .toString('hex')
              .toLowerCase();
          }
        }
      }
    }

    if (!messageDigestExtraidoHex) {
      throw new BadRequestException(
        'SIN_MESSAGE_DIGEST: El contenedor PKCS#7 no posee el atributo autenticado messageDigest.',
      );
    }

    let algoritmoCoincidente: string | null = null;
    for (const [alg, hashHex] of Object.entries(hashesCalculados)) {
      if (hashHex === messageDigestExtraidoHex) {
        algoritmoCoincidente = alg.toUpperCase();
        break;
      }
    }

    if (!algoritmoCoincidente) {
      throw new BadRequestException(
        'DOCUMENTO_ALTERADO: El hash criptográfico del documento PDF no coincide con el messageDigest sellado en la firma PKCS#7.',
      );
    }

    // 4. Si STRICT_CERT_NAME_MATCH=true en .env, exigir que el CN del certificado coincida con el Decano
    const exigirMatchEstricto =
      (process.env.STRICT_CERT_NAME_MATCH || 'false').toLowerCase() === 'true';

    if (exigirMatchEstricto) {
      const normalizar = (s: string) =>
        s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
      const cnNorm = normalizar(firmanteCN);
      const palabrasDecano = normalizar(nombreDecanoEsperado)
        .split(/\s+/)
        .filter((p) => p.length > 3);

      const coincideNombre = palabrasDecano.every((palabra) => cnNorm.includes(palabra));
      if (!coincideNombre) {
        throw new BadRequestException(
          `CERTIFICADO_NO_CORRESPONDE_AL_DECANO: El certificado pertenece a '${firmanteCN}', pero la resolución exige la firma de '${nombreDecanoEsperado}'.`,
        );
      }
    }

    return {
      firmanteCN,
      organizacion,
      algoritmoDigest: algoritmoCoincidente,
    };
  }

  // ==========================================================================
  // 5. VALIDACIÓN DE LOTE DE ARCHIVOS PDF CON AISLAMIENTO DE FALLOS
  // ==========================================================================
  async validarLotePdfsFirmados(
    archivos: Array<Express.Multer.File>,
    ejecutor: EjecutorFirma,
  ) {
    if (!archivos || archivos.length === 0) {
      throw new BadRequestException(
        'Debe adjuntar al menos un archivo PDF en el campo "archivos".',
      );
    }

    const procesados: ResultadoArchivoLote[] = [];
    const errores: ResultadoArchivoLote[] = [];

    for (const archivo of archivos) {
      const resultadoIndividual = await this.procesarArchivoFirmadoIndividual(archivo, ejecutor);
      if (resultadoIndividual.exito) {
        procesados.push(resultadoIndividual);
      } else {
        errores.push(resultadoIndividual);
      }
    }

    return {
      totalRecibidos: archivos.length,
      exitosos: procesados.length,
      fallidos: errores.length,
      procesados,
      errores,
    };
  }

  private async procesarArchivoFirmadoIndividual(
    archivo: Express.Multer.File,
    ejecutor: EjecutorFirma,
  ): Promise<ResultadoArchivoLote> {
    const buffer = archivo.buffer;
    const nombreArchivo = archivo.originalname || 'archivo_sin_nombre.pdf';
    const sha256Archivo = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
    const inicialesEjecutor = ejecutor?.iniciales || 'SYS';

    try {
      // 1. Validar Magic Bytes reales (%PDF-)
      if (buffer.length < 10 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new BadRequestException(
          'NO_ES_PDF: El archivo subido no tiene la cabecera binaria %PDF- válida.',
        );
      }

      // 2. Extraer ID-TRAMITE, VER y HASH en cascada de 3 niveles (resistente a Tocapu)
      const extraccion = await this.extraerIdentificadorEnCascada(buffer, nombreArchivo);

      let resolucion = extraccion.idTramite
        ? await this.prisma.resolucion.findUnique({
            where: { idTramiteControl: extraccion.idTramite },
          })
        : null;

      if (!resolucion && extraccion.numeroResolucionDetectado) {
        resolucion = await this.prisma.resolucion.findUnique({
          where: { numeroCompleto: extraccion.numeroResolucionDetectado },
        });
      }

      if (!resolucion) {
        throw new BadRequestException(
          'RESOLUCION_NO_IDENTIFICADA: No se pudo localizar en la base de datos ninguna resolución asociada al sello o número del documento subido.',
        );
      }

      // 3. Verificar estado actual y correspondencia de versión / hash
      if (resolucion.situacionJuridica === SituacionJuridicaRes.SIN_EFECTO) {
        throw new BadRequestException(
          `RESOLUCION_SIN_EFECTO: La resolución ${resolucion.numeroCompleto} fue dejada SIN_EFECTO y no admite firma.`,
        );
      }

      if (resolucion.estadoDocumental === EstadoDocumentalRes.FIRMADO) {
        throw new BadRequestException(
          `YA_FIRMADO: La resolución ${resolucion.numeroCompleto} ya se encuentra en estado FIRMADO e inmutable.`,
        );
      }

      if (
        extraccion.versionDetectada !== null &&
        extraccion.versionDetectada !== resolucion.versionPdf
      ) {
        throw new BadRequestException(
          `VERSION_DESACTUALIZADA: El PDF subido corresponde a la versión v${extraccion.versionDetectada}, pero la versión vigente emitida es la v${resolucion.versionPdf}.`,
        );
      }

      if (
        extraccion.hashDetectado !== null &&
        extraccion.hashDetectado.toUpperCase() !== resolucion.hashVersionGenerado.toUpperCase()
      ) {
        throw new BadRequestException(
          `HASH_VERSION_DESACTUALIZADO: El código HASH del PDF (${extraccion.hashDetectado}) no coincide con el último HASH emitido (${resolucion.hashVersionGenerado}).`,
        );
      }

      // 4. Validar criptográficamente la firma PKCS#7 / CAdES / PAdES
      const infoFirma = this.validarFirmaCriptograficaPkcs7(
        buffer,
        resolucion.nombreDecanoSnapshot,
      );

      // 5. Guardar archivo físico en ./storage/firmados/AAAA/SERIE/
      const carpetaDestino = path.join(
        this.storageRoot,
        String(resolucion.anioNumeracion),
        resolucion.serie,
      );
      if (!fs.existsSync(carpetaDestino)) {
        fs.mkdirSync(carpetaDestino, { recursive: true });
      }

      const nombreArchivoGuardado = `${resolucion.numeroCompleto}_FIRMADO.pdf`;
      const rutaAbsoluta = path.join(carpetaDestino, nombreArchivoGuardado);
      const rutaRelativaBd = path
        .relative(process.cwd(), rutaAbsoluta)
        .replace(/\\/g, '/');

      fs.writeFileSync(rutaAbsoluta, buffer);

      // 6. Transacción ACID: pasar a FIRMADO, actualizar tesista/expediente y auditar
      const resultadoTx = await this.prisma.$transaction(async (tx) => {
        const resActualizada = await tx.resolucion.update({
          where: { id: resolucion!.id },
          data: {
            estadoDocumental: EstadoDocumentalRes.FIRMADO,
            pdfFirmadoPath: rutaRelativaBd,
            pdfFirmadoSha256: sha256Archivo,
            fechaConfirmacionFirma: new Date(),
          },
        });

        if (resActualizada.tipo === TipoResolucion.APTO && resActualizada.tesistaId) {
          await tx.tesista.update({
            where: { id: resActualizada.tesistaId },
            data: { estado: EstadoTesista.APTO },
          });
        }

        let expedienteCerradoComoTitulado = false;

        if (
          resActualizada.tipo === TipoResolucion.TITULO &&
          resActualizada.tesistaId &&
          resActualizada.expedienteId
        ) {
          await tx.tesista.update({
            where: { id: resActualizada.tesistaId },
            data: { estado: EstadoTesista.TITULADO },
          });

          const tesistasActivos = await tx.tesista.findMany({
            where: {
              expedienteId: resActualizada.expedienteId,
              estado: { not: EstadoTesista.DESISTIDO },
            },
          });

          let todosConTituloFirmado = tesistasActivos.length > 0;
          for (const t of tesistasActivos) {
            if (!t.tituloResolucionId) {
              todosConTituloFirmado = false;
              break;
            }
            const rTit = await tx.resolucion.findUnique({
              where: { id: t.tituloResolucionId },
            });
            if (
              !rTit ||
              rTit.situacionJuridica !== SituacionJuridicaRes.VIGENTE ||
              rTit.estadoDocumental !== EstadoDocumentalRes.FIRMADO
            ) {
              todosConTituloFirmado = false;
              break;
            }
          }

          if (todosConTituloFirmado) {
            await tx.expediente.update({
              where: { id: resActualizada.expedienteId },
              data: { estado: EstadoExpediente.FINALIZADO },
            });
            expedienteCerradoComoTitulado = true;
          }
        }

        const usuarioAuditoriaId = await this.resolverUsuarioAuditoriaId(tx, ejecutor);
        if (usuarioAuditoriaId) {
          await tx.registroAuditoria.create({
            data: {
              usuarioId: usuarioAuditoriaId,
              inicialesUsuario: inicialesEjecutor,
              accion: 'VALIDACION_FIRMA_PDF',
              entidad: 'resoluciones',
              entidadId: resActualizada.id,
              expedienteId: resActualizada.expedienteId,
              resolucionId: resActualizada.id,
              detalle: {
                ejecutorIdJwt: ejecutor?.id ?? null,
                nombreArchivoSubido: nombreArchivo,
                numeroCompleto: resActualizada.numeroCompleto,
                idTramiteControl: resActualizada.idTramiteControl,
                metodoIdentificacionCascada: extraccion.metodo,
                firmanteCertificadoCN: infoFirma.firmanteCN,
                organizacionCertificado: infoFirma.organizacion,
                algoritmoDigest: infoFirma.algoritmoDigest,
                pdfFirmadoPath: rutaRelativaBd,
                pdfFirmadoSha256: sha256Archivo,
                expedienteCerradoComoTitulado,
              },
            },
          });
        } else {
          this.logger.warn(
            `No se encontró usuario espejo en esquema public para auditar VALIDACION_FIRMA_PDF (ejecutor JWT: ${ejecutor?.id}).`,
          );
        }

        return { resActualizada, expedienteCerradoComoTitulado };
      });

      return {
        nombreArchivo,
        sha256Archivo,
        exito: true,
        resolucionId: resultadoTx.resActualizada.id,
        numeroCompleto: resultadoTx.resActualizada.numeroCompleto,
        idTramiteDetectado: resultadoTx.resActualizada.idTramiteControl,
        metodoIdentificacion: extraccion.metodo,
        firmanteCertificado: infoFirma.firmanteCN,
        expedienteCerradoComoTitulado: resultadoTx.expedienteCerradoComoTitulado,
      };
    } catch (err: any) {
      const mensajeCompleto =
        err instanceof Error ? err.message : 'Error desconocido al validar el PDF firmado.';
      const partes = mensajeCompleto.split(':');
      const codigoError = partes.length > 1 ? partes[0].trim() : 'ERROR_VALIDACION_FIRMA';

      // Registro Forense en RegistroAuditoria (protegido para no abortar el lote)
      try {
        const usuarioAuditoriaId = await this.resolverUsuarioAuditoriaId(this.prisma, ejecutor);
        if (usuarioAuditoriaId && this.prisma.registroAuditoria) {
          await this.prisma.registroAuditoria.create({
            data: {
              usuarioId: usuarioAuditoriaId,
              inicialesUsuario: inicialesEjecutor,
              accion: 'RECHAZO_VALIDACION_FIRMA_PDF',
              entidad: 'resoluciones',
              detalle: {
                ejecutorIdJwt: ejecutor?.id ?? null,
                nombreArchivoSubido: nombreArchivo,
                sha256ArchivoSubido: sha256Archivo,
                codigoError,
                motivoRechazo: mensajeCompleto,
              },
            },
          });
        }
      } catch (auditErr) {
        this.logger.warn(
          `No se pudo registrar auditoría de rechazo para ${nombreArchivo}: ${(auditErr as Error).message}`,
        );
      }

      return {
        nombreArchivo,
        sha256Archivo,
        exito: false,
        codigoError,
        mensajeError: mensajeCompleto,
      };
    }
  }

  // ==========================================================================
  // 6. DESCARGAR EL ARCHIVO PDF FIRMADO ALMACENADO EN STORAGE
  // ==========================================================================
  async descargarPdfFirmadoGuardado(resolucionId: string): Promise<{
    buffer: Buffer;
    nombreArchivo: string;
    sha256: string;
  }> {
    const resolucion = await this.prisma.resolucion.findUnique({
      where: { id: resolucionId },
    });

    if (!resolucion) {
      throw new NotFoundException('La resolución solicitada no existe.');
    }

    if (
      resolucion.estadoDocumental !== EstadoDocumentalRes.FIRMADO ||
      !resolucion.pdfFirmadoPath
    ) {
      throw new BadRequestException(
        `La resolución ${resolucion.numeroCompleto} aún no cuenta con un archivo PDF firmado validado en el repositorio.`,
      );
    }

    const rutaAbsoluta = path.resolve(process.cwd(), resolucion.pdfFirmadoPath);
    if (!fs.existsSync(rutaAbsoluta)) {
      throw new NotFoundException(
        `El archivo físico firmado no fue encontrado en la ruta ${resolucion.pdfFirmadoPath}.`,
      );
    }

    const buffer = fs.readFileSync(rutaAbsoluta);
    return {
      buffer,
      nombreArchivo: path.basename(rutaAbsoluta),
      sha256: resolucion.pdfFirmadoSha256 || '',
    };
  }
}
