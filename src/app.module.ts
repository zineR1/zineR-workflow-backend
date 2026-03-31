import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { ExecutionsModule } from './executions/executions.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [AgentsModule, ExecutionsModule, LlmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
