import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoDocumentalRes,
  PrismaService,
  SituacionJuridicaRes,
} from '@app/database';
import { PDFDocument } from 'pdf-lib';
import AdmZip = require('adm-zip');
import { FirmasServiceService } from './firmas-service.service';

describe('FirmasServiceService', () => {
  let service: FirmasServiceService;
  let prismaMock: {
    resolucion: { findUnique: jest.Mock };
    usuario: { findUnique: jest.Mock; findFirst: jest.Mock };
    registroAuditoria: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      resolucion: { findUnique: jest.fn() },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      registroAuditoria: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirmasServiceService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<FirmasServiceService>(FirmasServiceService);
  });

  it('debe rechazar un archivo que no es PDF', async () => {
    const archivoInvalido = {
      originalname: 'documento.txt',
      buffer: Buffer.from('esto no es un pdf'),
    } as Express.Multer.File;

    const resultado = await service.validarLotePdfsFirmados([archivoInvalido], {
      id: 'user-1',
      iniciales: 'USR',
    });

    expect(resultado.totalRecibidos).toBe(1);
    expect(resultado.exitosos).toBe(0);
    expect(resultado.fallidos).toBe(1);
    expect(resultado.errores[0].exito).toBe(false);
    expect(resultado.errores[0].codigoError).toBe('NO_ES_PDF');
    expect(resultado.errores[0].mensajeError).toContain('NO_ES_PDF');
  });

  it('debe rechazar un PDF cuyo identificador no existe en la base de datos', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    pdfDoc.setSubject('ID-TRAMITE: TRAM-2026-9999-AABBCCDD | VER: 1 | HASH: ABCDEF12');
    const pdfBytes = Buffer.from(await pdfDoc.save());

    prismaMock.resolucion.findUnique.mockResolvedValue(null);

    const archivo = {
      originalname: 'resolucion_desconocida.pdf',
      buffer: pdfBytes,
    } as Express.Multer.File;

    const resultado = await service.validarLotePdfsFirmados([archivo], {
      id: 'user-1',
      iniciales: 'USR',
    });

    expect(resultado.exitosos).toBe(0);
    expect(resultado.fallidos).toBe(1);
    expect(resultado.errores[0].exito).toBe(false);
    expect(resultado.errores[0].codigoError).toBe('RESOLUCION_NO_IDENTIFICADA');
  });

  it('debe identificar el sello TRAM de titulacion-service (hash case-insensitive) y rechazar si no tiene firma digital', async () => {
    const hashLower = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    pdfDoc.setSubject(
      `ID-TRAMITE: TRAM-2026-0001-ABCD1234 | VER: 1 | HASH: ${hashLower}`,
    );
    const pdfBytes = Buffer.from(await pdfDoc.save());

    prismaMock.resolucion.findUnique.mockResolvedValue({
      id: 'res-1',
      idTramiteControl: 'TRAM-2026-0001-ABCD1234',
      numeroCompleto: 'RES-ORD-2026-0001',
      versionPdf: 1,
      hashVersionGenerado: hashLower,
      estadoDocumental: EstadoDocumentalRes.EMITIDO,
      situacionJuridica: SituacionJuridicaRes.VIGENTE,
      nombreDecanoSnapshot: 'Dr. Juan Perez',
    });

    const archivo = {
      originalname: 'RES-ORD-2026-0001_v1.pdf',
      buffer: pdfBytes,
    } as Express.Multer.File;

    const resultado = await service.validarLotePdfsFirmados([archivo], {
      id: 'user-1',
      iniciales: 'USR',
    });

    expect(resultado.exitosos).toBe(0);
    expect(resultado.fallidos).toBe(1);
    expect(resultado.errores[0].exito).toBe(false);
    expect(resultado.errores[0].codigoError).toBe('SIN_FIRMA_DIGITAL');
  });

  it('debe descomprimir un paquete .ZIP, ignorar manifiesto_lote.json/__MACOSX y validar cada PDF extraído', async () => {
    const hashLower = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    pdfDoc.setSubject(
      `ID-TRAMITE: TRAM-2026-0002-ABCD1234 | VER: 1 | HASH: ${hashLower}`,
    );
    const pdfBytes = Buffer.from(await pdfDoc.save());

    const zip = new AdmZip();
    zip.addFile('RES-ORD-2026-0002_v1.pdf', pdfBytes);
    zip.addFile('manifiesto_lote.json', Buffer.from('{}', 'utf-8'));
    zip.addFile('__MACOSX/._RES-ORD-2026-0002_v1.pdf', Buffer.from('junk'));

    prismaMock.resolucion.findUnique.mockResolvedValue({
      id: 'res-2',
      idTramiteControl: 'TRAM-2026-0002-ABCD1234',
      numeroCompleto: 'RES-ORD-2026-0002',
      versionPdf: 1,
      hashVersionGenerado: hashLower,
      estadoDocumental: EstadoDocumentalRes.EMITIDO,
      situacionJuridica: SituacionJuridicaRes.VIGENTE,
      nombreDecanoSnapshot: 'Dr. Juan Perez',
    });

    const archivoZip = {
      originalname: 'lote_gmail_firmado.zip',
      buffer: zip.toBuffer(),
    } as Express.Multer.File;

    const resultado = await service.validarLotePdfsFirmados([archivoZip], {
      id: 'user-1',
      iniciales: 'USR',
    });

    expect(resultado.totalRecibidos).toBe(1);
    expect(resultado.fallidos).toBe(1);
    expect(resultado.errores[0].nombreArchivo).toBe('RES-ORD-2026-0002_v1.pdf');
    expect(resultado.errores[0].origenZip).toBe('lote_gmail_firmado.zip');
    expect(resultado.errores[0].codigoError).toBe('SIN_FIRMA_DIGITAL');
  });
});
