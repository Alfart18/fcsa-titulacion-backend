import { Module } from '@nestjs/common';
import { IdentidadServiceController } from './identidad-service.controller';
import { IdentidadServiceService } from './identidad-service.service';

@Module({
  imports: [],
  controllers: [IdentidadServiceController],
  providers: [IdentidadServiceService],
})
export class IdentidadServiceModule {}
