import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { IdentidadServiceController } from './identidad-service.controller';
import { IdentidadServiceService } from './identidad-service.service';

@Module({
  imports: [CommonModule],
  controllers: [IdentidadServiceController],
  providers: [IdentidadServiceService],
})
export class IdentidadServiceModule {}