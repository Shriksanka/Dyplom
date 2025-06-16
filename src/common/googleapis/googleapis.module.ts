import { Module } from '@nestjs/common';
import { GmailModule } from './gmail/gmail.module';

@Module({
  imports: [GmailModule]
})
export class GoogleapisModule {}
