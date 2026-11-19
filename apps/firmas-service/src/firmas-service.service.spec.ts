import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { EstadoDocumentalRes, SituacionJuridicaRes } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { FirmasServiceService } from './firmas-service.service';

describe('FirmasServiceService', () => {
  let service: FirmasServiceService;
  let prismaMock: {
    resolucion: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      resolucion: { findUnique: jest.fn() },
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

    const resultado = await service.validarLotePdfsFirmados([archivoInvalido], { id: 'user-1' });

    expect(resultado.totalRecibidos).toBe(1);
    expect(resultado.totalExitosos).toBe(0);
    expect(resultado.totalFallidos).toBe(1);
    expect(resultado.resultados[0].exito).toBe(false);
    expect(resultado.resultados[0].mensajeError).toContain('NO_ES_PDF');
  });

  it('debe rechazar un PDF cuyo identificador no existe en la base de datos', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    pdfDoc.setTitle('ID-TRAMITE: TRAM-INEXISTENTE');
    const pdfBytes = Buffer.from(await pdfDoc.save());

    prismaMock.resolucion.findUnique.mockResolvedValue(null);

    const archivo = {
      originalname: 'resolucion_desconocida.pdf',
      buffer: pdfBytes,
    } as Express.Multer.File;

    const resultado = await service.validarLotePdfsFirmados([archivo], { id: 'user-1' });

    expect(resultado.totalExitosos).toBe(0);
    expect(resultado.totalFallidos).toBe(1);
    expect(resultado.resultados[0].exito).toBe(false);
    expect(resultado.resultados[0].mensajeError).toContain('RESOLUCION_NO_IDENTIFICADA');
  });

  it('debe rechazar un PDF con identificador válido pero sin firma digital', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    pdfDoc.setSubject('ID-TRAMITE: TRAM-2026-001 | VER: 1 | HASH: ABC123');
    const pdfBytes = Buffer.from(await pdfDoc.save());

    prismaMock.resolucion.findUnique.mockResolvedValue({
      id: 'res-1',
      idTramiteControl: 'TRAM-2026-001',
      numeroCompleto: 'RES-001-2026',
      versionPdf: 1,
      hashVersionGenerado: 'ABC123',
      estadoDocumental: EstadoDocumentalRes.EMITIDO,
      situacionJuridica: SituacionJuridicaRes.VIGENTE,
      nombreDecanoSnapshot: 'Dr. Juan Perez',
    });

    const archivo = {
      originalname: 'RES-001-2026_v1.pdf',
      buffer: pdfBytes,
    } as Express.Multer.File;

    const resultado = await service.validarLotePdfsFirmados([archivo], { id: 'user-1' });

    expect(resultado.totalExitosos).toBe(0);
    expect(resultado.totalFallidos).toBe(1);
    expect(resultado.resultados[0].exito).toBe(false);
  });
});
