import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { FirmasServiceController } from './firmas-service.controller';
import { FirmasServiceService } from './firmas-service.service';

@Module({
  imports: [CommonModule],
  controllers: [FirmasServiceController],
  providers: [FirmasServiceService],
})
export class FirmasServiceModule {}