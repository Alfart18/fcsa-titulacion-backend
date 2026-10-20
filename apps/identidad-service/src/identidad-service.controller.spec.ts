import { Test, TestingModule } from '@nestjs/testing';
import { IdentidadServiceController } from './identidad-service.controller';
import { IdentidadServiceService } from './identidad-service.service';

describe('IdentidadServiceController', () => {
  let identidadServiceController: IdentidadServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [IdentidadServiceController],
      providers: [IdentidadServiceService],
    }).compile();

    identidadServiceController = app.get<IdentidadServiceController>(IdentidadServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(identidadServiceController.getHello()).toBe('Hello World!');
    });
  });
});
