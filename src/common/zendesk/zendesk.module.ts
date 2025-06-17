import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZendeskService } from './zendesk.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        baseURL: `https://${config.get('ZENDESK_DOMAIN')}.zendesk.com/api/v2`,
        timeout: 20000,
        validateStatus: (status) => {
          return [200, 201, 422, 404].includes(status);
        },
      }),
      inject: [ConfigService],
    }),
    ,
  ],
  providers: [ZendeskService],
  exports: [ZendeskService],
})
export class ZendeskModule {}
