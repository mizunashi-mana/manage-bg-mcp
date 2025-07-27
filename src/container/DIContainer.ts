import { Container } from 'inversify';
import { type BgProcessManager, BgProcessManagerImpl, BgProcessManagerTag } from '@/services/BgProcessManager.js';
import { ConfigProviderTag, type ConfigProvider } from '@/services/ConfigProvider.js';
import { type Logging, LoggingImpl, LoggingTag } from '@/services/Logging.js';
import { BgManageServer } from '@/services/ManageBgServer.js';
import { PackageInfoProviderTag, type PackageInfoProvider } from '@/services/PackageInfoProvider.js';
import { type ProcessController, ProcessControllerTag, ProcessControllerImpl } from '@/services/ProcessController.js';
import { type ProcessLogBuffer, ProcessLogBufferImpl, ProcessLogBufferTag } from '@/services/ProcessLogBuffer.js';
import { GetInfoHandler } from '@/services/tools/GetInfoHandler.js';
import { GetLogsHandler } from '@/services/tools/GetLogsHandler.js';
import { ListHandler } from '@/services/tools/ListHandler.js';
import { RestartHandler } from '@/services/tools/RestartHandler.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { StopAllHandler } from '@/services/tools/StopAllHandler.js';
import { StopHandler } from '@/services/tools/StopHandler.js';

export class DIContainer {
  constructor(private readonly container: Container) {}

  getServer(): BgManageServer {
    return this.container.get(BgManageServer);
  }

  getProcessManager(): BgProcessManager {
    return this.container.get(BgProcessManagerTag);
  }
}

export function buildContainer(props: {
  configProviderImpl: ConfigProvider;
  packageInfoProviderImpl: PackageInfoProvider;
}): DIContainer {
  const container = new Container();

  container.bind<ConfigProvider>(ConfigProviderTag).toConstantValue(props.configProviderImpl);
  container.bind<PackageInfoProvider>(PackageInfoProviderTag).toConstantValue(props.packageInfoProviderImpl);

  // Bind core services (Note: Bind ProcessController before BgProcessManager)
  container.bind<Logging>(LoggingTag).to(LoggingImpl).inSingletonScope();
  container.bind<ProcessLogBuffer>(ProcessLogBufferTag).to(ProcessLogBufferImpl).inSingletonScope();
  container.bind<ProcessController>(ProcessControllerTag).to(ProcessControllerImpl).inSingletonScope();
  container.bind<BgProcessManager>(BgProcessManagerTag).to(BgProcessManagerImpl).inSingletonScope();

  container.bind<StartHandler>(StartHandler).to(StartHandler).inSingletonScope();
  container.bind<StopHandler>(StopHandler).to(StopHandler).inSingletonScope();
  container.bind<RestartHandler>(RestartHandler).to(RestartHandler).inSingletonScope();
  container.bind<StopAllHandler>(StopAllHandler).to(StopAllHandler).inSingletonScope();
  container.bind<ListHandler>(ListHandler).to(ListHandler).inSingletonScope();
  container.bind<GetInfoHandler>(GetInfoHandler).to(GetInfoHandler).inSingletonScope();
  container.bind<GetLogsHandler>(GetLogsHandler).to(GetLogsHandler).inSingletonScope();

  container.bind<BgManageServer>(BgManageServer).to(BgManageServer).inSingletonScope();

  return new DIContainer(container);
}
