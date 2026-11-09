import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IdentidadClient } from './identidad.client';
import { TitulacionClient } from './titulacion.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  providers: [IdentidadClient, TitulacionClient],
  exports: [IdentidadClient, TitulacionClient],
})
export class ClientsModule {}