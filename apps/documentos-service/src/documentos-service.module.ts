import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { DocumentosServiceController } from './documentos-service.controller';
import { DocumentosServiceService } from './documentos-service.service';

@Module({
  imports: [CommonModule],
  controllers: [DocumentosServiceController],
  providers: [DocumentosServiceService],
})
export class DocumentosServiceModule {}
