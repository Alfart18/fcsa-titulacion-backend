import { Controller, Get } from '@nestjs/common';
import { IdentidadServiceService } from './identidad-service.service';

@Controller()
export class IdentidadServiceController {
  constructor(private readonly identidadServiceService: IdentidadServiceService) {}

  @Get()
  getHello(): string {
    return this.identidadServiceService.getHello();
  }
}
